/*
 * Lung-sound AI (experimental). Runs the model from ml/train_icbhi.py
 * in the browser. Audio never leaves the device.
 *
 * It labels short windows as normal / crackle / wheeze / both.
 * It does NOT detect cancer. The training data (ICBHI 2017) was recorded
 * with stethoscopes, so a phone on the chest is a different input.
 * We show the result as a talking point for a doctor, nothing more.
 *
 * The feature math must match features() in ml/train_icbhi.py.
 */
(function () {
    const box = document.getElementById("lung-ai");
    if (!box) {
        return;
    }
    let model = null;

    function melFilters(m) {
        const hzToMel = function (f) {
            return 2595 * Math.log10(1 + f / 700);
        };
        const melToHz = function (x) {
            return 700 * (Math.pow(10, x / 2595) - 1);
        };
        const lo = hzToMel(m.fmin);
        const hi = hzToMel(m.fmax);
        const bins = [];
        for (let i = 0; i < m.n_mels + 2; i++) {
            const mel = lo + (hi - lo) * i / (m.n_mels + 1);
            bins.push(Math.floor((m.n_fft + 1) * melToHz(mel) / m.sr));
        }
        const nb = m.n_fft / 2 + 1;
        const fb = [];
        for (let k = 1; k <= m.n_mels; k++) {
            const row = new Float64Array(nb);
            const l = bins[k - 1];
            const c = bins[k];
            const r = bins[k + 1];
            for (let j = l; j < c; j++) {
                row[j] = (j - l) / Math.max(c - l, 1);
            }
            for (let j = c; j < r; j++) {
                row[j] = (r - j) / Math.max(r - c, 1);
            }
            fb.push(row);
        }
        return fb;
    }

    function prepare(m) {
        const n = m.n_fft;
        const nb = n / 2 + 1;
        m.fb = melFilters(m);
        m.win = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            m.win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
        }
        m.cos = [];
        m.sin = [];
        for (let k = 0; k < nb; k++) {
            const c = new Float64Array(n);
            const s = new Float64Array(n);
            for (let i = 0; i < n; i++) {
                c[i] = Math.cos(2 * Math.PI * k * i / n);
                s[i] = Math.sin(2 * Math.PI * k * i / n);
            }
            m.cos.push(c);
            m.sin.push(s);
        }
        return m;
    }

    function features(m, input) {
        const n = m.n_fft;
        const nb = n / 2 + 1;
        let x = Float64Array.from(input);
        let mean = 0;
        for (let i = 0; i < x.length; i++) {
            mean += x[i];
        }
        mean /= x.length;
        let peak = 0;
        for (let i = 0; i < x.length; i++) {
            x[i] -= mean;
            peak = Math.max(peak, Math.abs(x[i]));
        }
        if (peak > 0) {
            for (let i = 0; i < x.length; i++) {
                x[i] /= peak;
            }
        }
        if (x.length < n) {
            const padded = new Float64Array(n);
            padded.set(x);
            x = padded;
        }

        const frames = [];
        const frame = new Float64Array(n);
        const power = new Float64Array(nb);
        for (let start = 0; start + n <= x.length; start += m.hop) {
            for (let i = 0; i < n; i++) {
                frame[i] = x[start + i] * m.win[i];
            }
            for (let k = 0; k < nb; k++) {
                let re = 0;
                let im = 0;
                const c = m.cos[k];
                const s = m.sin[k];
                for (let i = 0; i < n; i++) {
                    re += frame[i] * c[i];
                    im -= frame[i] * s[i];
                }
                power[k] = re * re + im * im;
            }
            const mel = new Float64Array(m.n_mels);
            for (let b = 0; b < m.n_mels; b++) {
                let sum = 0;
                const row = m.fb[b];
                for (let k = 0; k < nb; k++) {
                    sum += row[k] * power[k];
                }
                mel[b] = Math.log(sum + 1e-6);
            }
            frames.push(mel);
        }

        const B = m.n_mels;
        const T = frames.length;
        const mu = new Float64Array(B);
        const sd = new Float64Array(B);
        const dl = new Float64Array(B);
        for (let b = 0; b < B; b++) {
            let s = 0;
            for (let t = 0; t < T; t++) {
                s += frames[t][b];
            }
            mu[b] = s / T;
            let v = 0;
            for (let t = 0; t < T; t++) {
                v += Math.pow(frames[t][b] - mu[b], 2);
            }
            sd[b] = Math.sqrt(v / T);
            if (T > 1) {
                let d = 0;
                for (let t = 1; t < T; t++) {
                    d += Math.abs(frames[t][b] - frames[t - 1][b]);
                }
                dl[b] = d / (T - 1);
            }
        }
        let z = 0;
        for (let i = 1; i < x.length; i++) {
            z += Math.abs(Math.sign(x[i]) - Math.sign(x[i - 1]));
        }
        const zcr = z / (x.length - 1) / 2;
        return [].concat(Array.from(mu), Array.from(sd), Array.from(dl), [zcr]);
    }

    function classify(m, f) {
        const scores = m.coef.map(function (w, c) {
            let s = m.intercept[c];
            for (let i = 0; i < f.length; i++) {
                s += w[i] * (f[i] - m.mean[i]) / m.std[i];
            }
            return s;
        });
        const max = Math.max.apply(null, scores);
        const exp = scores.map(function (s) {
            return Math.exp(s - max);
        });
        const total = exp.reduce(function (a, b) {
            return a + b;
        }, 0);
        const probs = exp.map(function (e) {
            return e / total;
        });
        return m.classes[probs.indexOf(Math.max.apply(null, probs))];
    }

    async function toModelRate(blob, sr) {
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
        ctx.close();
        const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * sr), sr);
        const src = off.createBufferSource();
        src.buffer = decoded;
        src.connect(off.destination);
        src.start();
        const out = await off.startRendering();
        return out.getChannelData(0);
    }

    function analyse(samples) {
        const win = Math.round(model.sr * 2.5);
        const hop = Math.round(model.sr * 1.25);
        const counts = { normal: 0, crackle: 0, wheeze: 0, both: 0 };
        let total = 0;
        for (let s = 0; s + win <= samples.length; s += hop) {
            counts[classify(model, features(model, samples.subarray(s, s + win)))]++;
            total++;
        }
        return { counts: counts, total: total };
    }

    BW.lungSound = {
        features: function (arr) {
            return features(model, arr);
        },
        analyse: analyse,
        ready: function () {
            return model !== null;
        }
    };

    async function record() {
        const out = document.getElementById("lung-ai-result");
        const btn = document.getElementById("lung-ai-start");
        btn.disabled = true;
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
        } catch (err) {
            out.textContent = "The microphone is blocked.";
            btn.disabled = false;
            return;
        }
        const rec = new MediaRecorder(stream);
        const chunks = [];
        rec.ondataavailable = function (e) {
            chunks.push(e.data);
        };
        rec.onstop = async function () {
            stream.getTracks().forEach(function (t) {
                t.stop();
            });
            out.textContent = "Listening to the recording…";
            const samples = await toModelRate(new Blob(chunks), model.sr);
            const r = analyse(samples);
            const abnormal = r.counts.crackle + r.counts.wheeze + r.counts.both;
            BW.measures.lungSound = r;
            out.textContent = r.total === 0
                ? "The recording was too short."
                : abnormal + " of " + r.total + " windows sounded like crackles or wheezes (experimental). " +
                  (abnormal / r.total > 0.3 ? "Mention this to a doctor." : "Mostly normal sounds.");
            btn.disabled = false;
        };
        rec.start();
        let left = 15;
        out.textContent = "Breathe deeply through your mouth… " + left;
        const timer = setInterval(function () {
            left--;
            out.textContent = "Breathe deeply through your mouth… " + left;
            if (left <= 0) {
                clearInterval(timer);
                rec.stop();
            }
        }, 1000);
    }

    fetch("data/lung_model.json")
        .then(function (res) {
            if (!res.ok) {
                throw new Error("no model");
            }
            return res.json();
        })
        .then(function (m) {
            model = prepare(m);
            box.hidden = false;
            document.getElementById("lung-ai-score").textContent =
                "Model test score (ICBHI): " + m.test.icbhi_score + " on " + m.test.patients + " patients it never saw.";
            document.getElementById("lung-ai-start").addEventListener("click", record);
        })
        .catch(function () {
            box.hidden = true;
        });
})();
