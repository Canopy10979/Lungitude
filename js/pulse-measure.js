/*
 * Pulse from the phone camera (photoplethysmography, PPG).
 *
 * The fingertip covers the back camera and the flash. With each heartbeat,
 * more blood enters the fingertip and the red image gets a little darker.
 * We read the average red level about 30 times a second. No video is saved.
 *
 * We report:
 *   heart rate   from the autocorrelation of the signal (40-180 bpm)
 *   quality      how regular the beat is (0 to 1)
 *   perfusion    pulse strength = beat size / light level, in %
 *
 * We do NOT report blood oxygen (SpO2). That needs two light colors and
 * calibration, which a phone camera does not have. The user can type in a
 * reading from a clip-on pulse oximeter instead.
 */
(function () {
    let activeCancel = null;
    let generation = 0;
    const SECONDS = 25;
    const SETTLE = 3;
    const RATE = 30;

    const btn = document.getElementById("pulse-start");
    if (!btn) {
        return;
    }
    const out = document.getElementById("pulse-result");
    const canvas = document.getElementById("pulse-wave");
    const g = canvas.getContext("2d");
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const grab = document.createElement("canvas");
    grab.width = 40;
    grab.height = 30;
    const gg = grab.getContext("2d", { willReadFrequently: true });

    function meanRgb() {
        gg.drawImage(video, 0, 0, grab.width, grab.height);
        const d = gg.getImageData(10, 8, 20, 14).data;
        let r = 0;
        let gr = 0;
        let b = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
            r += d[i];
            gr += d[i + 1];
            b += d[i + 2];
        }
        return [r / n, gr / n, b / n];
    }

    function fingerOn(rgb) {
        return rgb[0] > 60 && rgb[0] > 1.8 * rgb[1] && rgb[0] > 1.8 * rgb[2];
    }

    function resample(samples) {
        const t0 = samples[0].t;
        const t1 = samples[samples.length - 1].t;
        const n = Math.floor((t1 - t0) * RATE);
        const out = new Float64Array(n);
        let j = 0;
        for (let i = 0; i < n; i++) {
            const t = t0 + i / RATE;
            while (j < samples.length - 2 && samples[j + 1].t < t) {
                j++;
            }
            const a = samples[j];
            const b = samples[j + 1];
            const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
            out[i] = a.v + f * (b.v - a.v);
        }
        return out;
    }

    function movingAverage(x, w) {
        const out = new Float64Array(x.length);
        let sum = 0;
        for (let i = 0; i < x.length; i++) {
            sum += x[i];
            if (i >= w) {
                sum -= x[i - w];
            }
            out[i] = sum / Math.min(i + 1, w);
        }
        return out;
    }

    /* Detrend with a 1 s average, then smooth with a 0.15 s average. */
    function bandpass(x) {
        const trend = movingAverage(x, RATE);
        const shift = Math.floor(RATE / 2);
        const d = new Float64Array(x.length);
        for (let i = 0; i < x.length; i++) {
            d[i] = x[i] - trend[Math.min(x.length - 1, i + shift)];
        }
        const smooth = movingAverage(d, 5);
        const lag = 2;
        const y = new Float64Array(x.length);
        for (let i = 0; i < x.length; i++) {
            y[i] = -smooth[Math.min(x.length - 1, i + lag)];
        }
        return y;
    }

    BW.pulseAnalyse = function (raw, rate) {
        if (!Number.isFinite(rate) || rate !== RATE || !raw || raw.length < RATE * 8 || Array.from(raw).some(v => !Number.isFinite(v))) return null;
        const x = raw;
        const y = bandpass(x).slice(RATE, x.length - RATE);
        let mean = 0;
        for (let i = 0; i < y.length; i++) {
            mean += y[i];
        }
        mean /= y.length;
        let energy = 0;
        for (let i = 0; i < y.length; i++) {
            y[i] -= mean;
            energy += y[i] * y[i];
        }
        if (energy === 0) {
            return null;
        }
        const minLag = Math.round(rate * 60 / 180);
        const maxLag = Math.round(rate * 60 / 40);
        let best = -1;
        let bestLag = 0;
        const ac = [];
        for (let lag = minLag; lag <= maxLag; lag++) {
            let s = 0;
            for (let i = 0; i + lag < y.length; i++) {
                s += y[i] * y[i + lag];
            }
            const v = s / energy * y.length / (y.length - lag);
            ac.push(v);
            if (v > best) {
                best = v;
                bestLag = lag;
            }
        }
        /*
         * A pulse also matches itself at 2 and 3 beats, so the highest peak
         * can be a multiple of the true beat. Take the FIRST local peak that
         * is at least 85% as strong as the best one.
         */
        for (let i = 0; i < ac.length; i++) {
            if ((i === 0 || ac[i] >= ac[i - 1]) && (i === ac.length - 1 || ac[i] >= ac[i + 1]) && ac[i] >= 0.85 * best) {
                bestLag = i + minLag;
                best = ac[i];
                break;
            }
        }
        /* Refine the peak between samples (parabola through 3 points). */
        const k = bestLag - minLag;
        let lagF = bestLag;
        if (k > 0 && k < ac.length - 1) {
            const denom = ac[k - 1] - 2 * ac[k] + ac[k + 1];
            if (denom !== 0) {
                lagF = bestLag + 0.5 * (ac[k - 1] - ac[k + 1]) / denom;
            }
        }
        let dc = 0;
        for (let i = 0; i < x.length; i++) {
            dc += x[i];
        }
        dc /= x.length;
        const ampl = Math.sqrt(energy / y.length) * 2 * Math.SQRT2;
        return {
            bpm: 60 * rate / lagF,
            quality: Math.max(0, Math.min(1, best)),
            perfusion: 100 * ampl / dc,
            wave: y
        };
    };

    const $ = id => document.getElementById(id);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    let lastLiveEstimate = -Infinity;
    function setText(id, text) {if ($(id).textContent !== text) $(id).textContent = text;}
    function clearMonitor(stage) {
        $('finger-contact-glow').setAttribute('opacity', '0');
        $('pulse-live-bpm').textContent = '—';
        $('pulse-progress').value = 0;
        $('pulse-summary').hidden = true;
        setText('pulse-contact-state', 'No live signal.');
        setText('pulse-stage', stage);
        drawWave(null);
    }
    function drawWave(y) {
        const w = canvas.width, h = canvas.height;
        const left=80, right=24, top=30, bottom=66, pw=w-left-right, ph=h-top-bottom;
        g.clearRect(0,0,w,h);g.fillStyle='#0b1b28';g.fillRect(0,0,w,h);
        g.font='16px system-ui';g.textAlign='right';g.textBaseline='middle';
        for (const value of [-1,-.5,0,.5,1]) {
            const py=top+(1-value)/2*ph;
            g.strokeStyle=value===0?'#769aa8':'#294654';g.lineWidth=1;
            g.beginPath();g.moveTo(left,py);g.lineTo(w-right,py);g.stroke();
            g.fillStyle='#bcd5df';g.fillText(value>0?'+'+value:String(value),left-12,py);
        }
        g.textAlign='center';
        for(let seconds=0;seconds<=6;seconds++){
            const px=left+seconds/6*pw;
            g.strokeStyle='#294654';g.beginPath();g.moveTo(px,top);g.lineTo(px,h-bottom);g.stroke();
            g.fillStyle='#bcd5df';g.fillText(String(seconds-6),px,h-bottom+22);
        }
        g.fillStyle='#cee3eb';g.fillText('Seconds before latest plotted sample',left+pw/2,h-15);
        g.save();g.translate(19,top+ph/2);g.rotate(-Math.PI/2);g.fillText('Relative optical signal (scaled)',0,0);g.restore();
        if(!y||y.length<2){g.fillStyle='#9ab7c5';g.fillText('Waiting for a measurable optical signal',left+pw/2,top+ph/2-25);return;}
        const n=Math.min(y.length,RATE*6),part=y.slice(y.length-n);
        const max=Math.max(1e-6,...Array.from(part,Math.abs));
        g.beginPath();
        for(let i=0;i<n;i++){
            const seconds=(i-(n-1))/RATE;
            const px=left+(seconds+6)/6*pw;
            const py=top+ph/2-part[i]/max*(ph/2-8);
            if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
        }
        g.strokeStyle='#79e0cf';g.lineWidth=2.5;g.stroke();
        const last=part[part.length-1]/max;
        if(!reducedMotion)$('finger-contact-glow').setAttribute('opacity',String(.15+.75*(last+1)/2));
    }
    clearMonitor('Ready · no measurement yet');

    async function run() {
        window.dispatchEvent(new CustomEvent('lungitude-pulse-start',{detail:{mode:'finger'}}));
        const continuous=$('pulse-continuous').checked;
        $('pulse-continuous').disabled=true;
        let lastResult=-Infinity;
        const attempt = ++generation;
        clearMonitor('Requesting camera permission…');lastLiveEstimate=-Infinity;
        btn.disabled = true;
        out.textContent = "";
        BW.measures.pulse = null;
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: 320, height: 240, frameRate: 30 }
            });
        } catch (err) {
            if(attempt !== generation)return;
            clearMonitor('Camera unavailable · no result');
            out.textContent = "The camera is blocked. Allow it, or skip this step.";
            btn.disabled = false;$('pulse-continuous').disabled=false;
            return;
        }
        if (attempt !== generation) {stream.getTracks().forEach(t => t.stop());return;}
        activeCancel = () => {stream.getTracks().forEach(t => t.stop());video.pause();video.srcObject=null;btn.disabled=false;$('pulse-continuous').disabled=false;};
        const track = stream.getVideoTracks()[0];
        let torch = false;
        try {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            torch = true;
        } catch (err) {
            torch = false;
        }
        if (attempt !== generation) {stream.getTracks().forEach(t => t.stop());return;}
        video.srcObject = stream;
        try {await video.play();} catch (error) {if(attempt !== generation)return;if(activeCancel)activeCancel();activeCancel=null;clearMonitor('Camera unavailable · no result');out.textContent='Could not start the camera. Try again or use the manual wrist count.';return;}
        if (attempt !== generation) {stream.getTracks().forEach(t => t.stop());return;}

        const samples = [];
        const t0 = performance.now() / 1000;
        let offFor = 0;
        let lastT = t0;

        function stop(message, completed = false) {
            if(!completed)clearMonitor('Unable to measure · try again');
            else {$('finger-contact-glow').setAttribute('opacity','0');setText('pulse-contact-state','Measurement ended · illustration inactive');setText('pulse-stage','Complete · waveform is frozen');}
            stream.getTracks().forEach(function (t) {
                t.stop();
            });
            video.pause();video.srcObject=null;activeCancel=null;
            btn.disabled = false;$('pulse-continuous').disabled=false;
            btn.textContent = "Measure again";
            if (message) {
                out.textContent = message;
            }
        }

        function tick() {
            if(attempt !== generation)return;
            if(document.hidden){cancel();return;}
            const now = performance.now() / 1000;
            let rgb;try{rgb=meanRgb();}catch(error){stop('Could not read camera frames. Use the manual wrist count or try again.');return;}
            const dt = now - lastT;
            lastT = now;
            const elapsed = now - t0;

            if (!fingerOn(rgb)) {
                offFor += dt;
                clearMonitor('Waiting for camera coverage · no pulse estimate');
                setText('pulse-contact-state', 'Fingertip-like image not detected (heuristic)');
                out.textContent = torch
                    ? "Cover the camera and the flash fully with your fingertip."
                    : "Cover the camera with your fingertip, and hold the phone near a bright light.";
                if ((continuous || offFor > 1.5) && samples.length > 0) {
                    samples.length = 0;
                }
                if ((!continuous && elapsed > SECONDS + 20) || offFor > 20) {
                    stop("We could not see a fingertip. Try again in a brighter place.");
                    return;
                }
                requestAnimationFrame(tick);
                return;
            }
            offFor = 0;
            setText('pulse-contact-state', 'Fingertip-like image detected (heuristic)');
            samples.push({ t: now, v: rgb[0] });
            if(continuous)while(samples.length>1&&now-samples[0].t>SECONDS+SETTLE+1)samples.shift();
            const have = samples.length ? now - samples[0].t : 0;
            out.textContent = have < SETTLE
                ? "Hold still… the camera is adjusting."
                : continuous ? (have<SECONDS+SETTLE?"Live monitoring warm-up · "+Math.max(0,Math.ceil(SECONDS+SETTLE-have))+" s":"Live monitoring · rolling 25-second estimate") : "Hold still… " + Math.max(0, Math.ceil(SECONDS - have)) + " s";

            $('pulse-progress').value=Math.min(SECONDS,have);
            setText('pulse-stage',have<SETTLE?'Settling · hold still':continuous?'Live monitoring · rolling optical trace':'Recording · light variation, not an ECG');
            if(reducedMotion)$('finger-contact-glow').setAttribute('opacity','.25');
            if (samples.length > RATE * 2) {
                const live = bandpass(resample(samples.slice(-RATE * 8)));
                drawWave(live.slice(RATE, live.length - 3));
                if(have>=10 && now-lastLiveEstimate>=1){
                    lastLiveEstimate=now;
                    const candidate=BW.pulseAnalyse(resample(samples.filter(s=>s.t-samples[0].t>=SETTLE)),RATE);
                    $('pulse-live-bpm').textContent=candidate && candidate.quality>=.5?String(Math.round(candidate.bpm)):'—';
                }
            }

            if (have >= SECONDS+(continuous?SETTLE:0) && (!continuous || now-lastResult>=1)) {
                lastResult=now;
                const usable = samples.filter(function (s) {
                    return continuous ? now-s.t<=SECONDS : s.t - samples[0].t >= SETTLE;
                });
                const res = BW.pulseAnalyse(resample(usable), RATE);
                if (res === null || res.quality < 0.3) {
                    if(continuous){BW.measures.pulse=null;$('pulse-summary').hidden=true;$('pulse-live-bpm').textContent='—';out.textContent='Live signal is not reliable enough for a pulse estimate. Adjust contact or stop and retry.';requestAnimationFrame(tick);return;}
                    stop("The pulse signal was not clear. Press more lightly, keep still, and try again.");
                    return;
                }
                const quality = res.quality >= 0.5 ? "good" : "fair";
                BW.measures.pulse = {
                    hr: Math.round(res.bpm),
                    quality: quality,
                    perfusion: Math.round(res.perfusion * 100) / 100
                };
                drawWave(res.wave);
                $('pulse-summary').hidden=false;
                $('pulse-live-bpm').textContent=String(Math.round(res.bpm));
                $('pulse-final-bpm').textContent=Math.round(res.bpm)+' beats per minute · experimental';
                $('pulse-final-quality').textContent=(res.quality>=.5?'More consistent':'Less consistent')+' periodicity · heuristic only';
                if(continuous){out.textContent='Live experimental pulse estimate: '+Math.round(res.bpm)+' bpm · rolling 25-second window, not a diagnosis.';setText('pulse-stage','Live monitoring · stop when finished');requestAnimationFrame(tick);return;}
                stop("Experimental pulse estimate: " + Math.round(res.bpm) + " beats per minute (signal " + quality +
                    "). Not clinically validated; this does not assess cancer, oxygen saturation or heart rhythm disorders.", true);
                return;
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function cancel(){clearMonitor('Stopped · no result');BW.measures.pulse=null;generation++;if(activeCancel){activeCancel();activeCancel=null;}btn.disabled=false;$('pulse-continuous').disabled=false;out.textContent='Measurement stopped. No result produced.';}
    window.addEventListener('lungitude-pulse-start',e=>{if(e.detail?.mode!=='finger'&&(activeCancel||btn.disabled))cancel();});
    document.getElementById('pulse-stop').addEventListener('click',cancel);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&activeCancel)cancel();});
    window.addEventListener('pagehide',cancel);
    document.getElementById('manual-camera-live').addEventListener('click',()=>{if(btn.disabled)return;$('pulse-continuous').checked=true;btn.scrollIntoView?.({behavior:reducedMotion?'auto':'smooth',block:'center'});btn.click();});
    btn.addEventListener("click", run);
})();
