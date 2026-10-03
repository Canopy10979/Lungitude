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
        for (let i = 1; i < ac.length - 1; i++) {
            if (ac[i] >= ac[i - 1] && ac[i] >= ac[i + 1] && ac[i] >= 0.85 * best) {
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

    function drawWave(y) {
        const w = canvas.width;
        const h = canvas.height;
        g.clearRect(0, 0, w, h);
        if (!y || y.length < 2) {
            return;
        }
        const n = Math.min(y.length, RATE * 6);
        const part = y.slice(y.length - n);
        let max = 1e-6;
        part.forEach(function (v) {
            max = Math.max(max, Math.abs(v));
        });
        g.beginPath();
        for (let i = 0; i < n; i++) {
            const px = i / (n - 1) * w;
            const py = h / 2 - part[i] / max * (h / 2 - 6);
            if (i === 0) {
                g.moveTo(px, py);
            } else {
                g.lineTo(px, py);
            }
        }
        g.strokeStyle = "#b42318";
        g.lineWidth = 2;
        g.stroke();
    }

    async function run() {
        btn.disabled = true;
        out.textContent = "";
        BW.measures.pulse = null;
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: 320, height: 240, frameRate: 30 }
            });
        } catch (err) {
            out.textContent = "The camera is blocked. Allow it, or skip this step.";
            btn.disabled = false;
            return;
        }
        const track = stream.getVideoTracks()[0];
        let torch = false;
        try {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            torch = true;
        } catch (err) {
            torch = false;
        }
        video.srcObject = stream;
        await video.play();

        const samples = [];
        const t0 = performance.now() / 1000;
        let offFor = 0;
        let lastT = t0;

        function stop(message) {
            stream.getTracks().forEach(function (t) {
                t.stop();
            });
            btn.disabled = false;
            btn.textContent = "Measure again";
            if (message) {
                out.textContent = message;
            }
        }

        function tick() {
            const now = performance.now() / 1000;
            const rgb = meanRgb();
            const dt = now - lastT;
            lastT = now;
            const elapsed = now - t0;

            if (!fingerOn(rgb)) {
                offFor += dt;
                out.textContent = torch
                    ? "Cover the camera and the flash fully with your fingertip."
                    : "Cover the camera with your fingertip, and hold the phone near a bright light.";
                if (offFor > 1.5 && samples.length > 0) {
                    samples.length = 0;
                }
                if (elapsed > SECONDS + 20) {
                    stop("We could not see a fingertip. Try again in a brighter place.");
                    return;
                }
                requestAnimationFrame(tick);
                return;
            }
            offFor = 0;
            samples.push({ t: now, v: rgb[0] });
            const have = samples.length ? now - samples[0].t : 0;
            out.textContent = have < SETTLE
                ? "Hold still… the camera is adjusting."
                : "Hold still… " + Math.max(0, Math.ceil(SECONDS - have)) + " s";

            if (samples.length > RATE * 2) {
                const live = bandpass(resample(samples.slice(-RATE * 8)));
                drawWave(live.slice(RATE, live.length - 3));
            }

            if (have >= SECONDS) {
                const usable = samples.filter(function (s) {
                    return s.t - samples[0].t >= SETTLE;
                });
                const res = BW.pulseAnalyse(resample(usable), RATE);
                if (res === null || res.quality < 0.3) {
                    stop("The pulse signal was not clear. Press more lightly, keep still, and try again.");
                    return;
                }
                const quality = res.quality >= 0.5 ? "good" : "fair";
                BW.measures.pulse = {
                    hr: Math.round(res.bpm),
                    quality: quality,
                    perfusion: Math.round(res.perfusion * 100) / 100
                };
                stop("Heart rate " + Math.round(res.bpm) + " beats per minute (signal " + quality +
                    "). Pulse strength " + res.perfusion.toFixed(2) + "%.");
                return;
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    btn.addEventListener("click", run);
})();
