/*
 * Forced expiratory time (FET) from the microphone.
 *
 * We do not record or store audio. We read the loudness (RMS) of the
 * live signal about 60 times a second and keep only those numbers.
 *
 * 1. Countdown (3 s): measure the room noise floor.
 * 2. "Blow": exhale starts when loudness passes 4x the noise floor.
 * 3. Exhale ends at the last moment loudness is above 2.5x the floor
 *    and above 8% of the peak. We stop after 1.5 s of quiet, or at 15 s.
 */
(function () {
    const MAX_SECONDS = 15;
    const QUIET_STOP = 1.5;

    const ring = document.getElementById("breath-ring");
    const count = document.getElementById("breath-count");
    const out = document.getElementById("breath-result");
    const btn = document.getElementById("breath-start");
    const canvas = document.getElementById("breath-wave");
    const g = canvas.getContext("2d");

    function rms(buf) {
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
            sum += buf[i] * buf[i];
        }
        return Math.sqrt(sum / buf.length);
    }

    function percentile(arr, p) {
        if (arr.length === 0) {
            return 0;
        }
        const s = arr.slice().sort(function (a, b) {
            return a - b;
        });
        return s[Math.floor((s.length - 1) * p)];
    }

    function draw(env, startT, onset, end) {
        const w = canvas.width;
        const h = canvas.height;
        g.clearRect(0, 0, w, h);
        let peak = 0.05;
        env.forEach(function (p) {
            peak = Math.max(peak, p.v);
        });
        const span = Math.max(6, (env.length ? env[env.length - 1].t - startT : 0));

        if (onset !== null && end !== null) {
            g.fillStyle = "rgba(47,122,62,0.12)";
            const x1 = (onset - startT) / span * w;
            const x2 = (end - startT) / span * w;
            g.fillRect(x1, 0, x2 - x1, h);
        }

        g.beginPath();
        env.forEach(function (p, i) {
            const x = (p.t - startT) / span * w;
            const y = h - (p.v / peak) * (h - 10) - 4;
            if (i === 0) {
                g.moveTo(x, y);
            } else {
                g.lineTo(x, y);
            }
        });
        g.strokeStyle = "#0e5c57";
        g.lineWidth = 2;
        g.stroke();
    }

    function describe(fet) {
        if (fet < 6) {
            return fet.toFixed(1) + " seconds. That is in the typical range.";
        }
        if (fet < 9) {
            return fet.toFixed(1) + " seconds. That is longer than typical. Ask a doctor about a breathing test (spirometry).";
        }
        return fet.toFixed(1) + " seconds. That is long. A long forced exhale can be a sign of blocked airways. Ask a doctor about spirometry.";
    }

    async function run() {
        btn.disabled = true;
        out.textContent = "";
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
        } catch (err) {
            out.textContent = "The microphone is blocked. Allow it, or skip this step.";
            btn.disabled = false;
            return;
        }

        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 2048;
        src.connect(an);
        const buf = new Float32Array(an.fftSize);

        const env = [];
        const t0 = performance.now() / 1000;
        const goAt = t0 + 3;
        let floor = null;
        let onset = null;
        let peak = 0;
        let lastLoud = null;

        function stop(message) {
            stream.getTracks().forEach(function (t) {
                t.stop();
            });
            ctx.close();
            btn.disabled = false;
            btn.textContent = "Try again";
            ring.className = "breath-ring";
            if (message) {
                out.textContent = message;
            }
        }

        function tick() {
            const now = performance.now() / 1000;
            an.getFloatTimeDomainData(buf);
            const v = rms(buf);
            env.push({ t: now, v: v });

            if (now < goAt) {
                ring.className = "breath-ring wait";
                count.textContent = "Breathe in " + Math.ceil(goAt - now);
                draw(env, t0, null, null);
                requestAnimationFrame(tick);
                return;
            }

            if (floor === null) {
                const quiet = env.filter(function (p) {
                    return p.t < goAt;
                }).map(function (p) {
                    return p.v;
                });
                floor = Math.max(percentile(quiet, 0.3), 0.002);
            }

            ring.className = "breath-ring go";
            count.textContent = onset === null ? "Blow!" : (now - onset).toFixed(1) + " s";

            if (onset === null && v > floor * 4) {
                onset = now;
            }
            if (onset !== null) {
                peak = Math.max(peak, v);
                if (v > Math.max(floor * 2.5, peak * 0.08)) {
                    lastLoud = now;
                }
            }

            draw(env, t0, onset, lastLoud);

            const tooLong = now - goAt > MAX_SECONDS;
            const doneQuiet = onset !== null && lastLoud !== null && now - lastLoud > QUIET_STOP;
            if (tooLong || doneQuiet) {
                if (onset === null) {
                    stop("We could not hear the exhale. Move the phone closer and try again.");
                    return;
                }
                const fet = lastLoud - onset;
                if (fet < 0.5) {
                    stop("That was too short. Blow out for as long as you can.");
                    return;
                }
                BW.measures.fet = Math.round(fet * 10) / 10;
                stop(describe(fet));
                return;
            }
            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    btn.addEventListener("click", run);
})();
