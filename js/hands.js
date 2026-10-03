/*
 * Camera checks. Photos stay in the browser. Only numbers go to the server.
 *
 * A. Phalangeal depth ratio (PDR) = finger depth at the nail fold (DPD)
 *    divided by finger depth at the last joint (IPD). Healthy fingers are
 *    below 1.0. Above 1.0 is a sign of clubbing. A ratio has no units, so
 *    camera distance does not matter.
 * C. Nail-bed color, white-balanced against paper in the same photo.
 *    Experimental and not calibrated. It is one weak signal only.
 */
(function () {
    const TAPS = [
        "1/4 · Tap the TOP of the finger where the nail starts.",
        "2/4 · Tap the BOTTOM of the finger, straight below that point.",
        "3/4 · Tap the TOP of the finger at the joint nearest the nail.",
        "4/4 · Tap the BOTTOM of the finger, straight below that joint."
    ];

    function loadToCanvas(file, canvas, done) {
        const img = new Image();
        img.onload = function () {
            const scale = Math.min(1, 900 / img.width);
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(img.src);
            done(img);
        };
        img.src = URL.createObjectURL(file);
    }

    function canvasPoint(canvas, e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * canvas.width / r.width,
            y: (e.clientY - r.top) * canvas.height / r.height
        };
    }

    function dist(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    /* A. Finger profile */
    const fFile = document.getElementById("finger-file");
    const fBox = document.getElementById("finger-tapper");
    const fCanvas = document.getElementById("finger-canvas");
    const hint = document.getElementById("tap-hint");
    const pdrOut = document.getElementById("pdr-result");
    let photo = null;
    let pts = [];

    function redraw() {
        const g = fCanvas.getContext("2d");
        g.drawImage(photo, 0, 0, fCanvas.width, fCanvas.height);
        g.lineWidth = Math.max(2, fCanvas.width / 300);
        pts.forEach(function (p, i) {
            g.fillStyle = i < 2 ? "#b42318" : "#0e5c57";
            g.beginPath();
            g.arc(p.x, p.y, g.lineWidth * 3, 0, Math.PI * 2);
            g.fill();
        });
        [[0, 1, "#b42318"], [2, 3, "#0e5c57"]].forEach(function (seg) {
            if (pts[seg[1]]) {
                g.strokeStyle = seg[2];
                g.beginPath();
                g.moveTo(pts[seg[0]].x, pts[seg[0]].y);
                g.lineTo(pts[seg[1]].x, pts[seg[1]].y);
                g.stroke();
            }
        });
        hint.textContent = pts.length < 4 ? TAPS[pts.length] : "";
    }

    /* Must match PDR_MIN, PDR_MAX and PDR_SPREAD_MAX in api/lib.php. */
    const PDR_MIN = 0.6;
    const PDR_MAX = 1.6;
    const SPREAD_MAX = 0.05;
    const TRIALS = 3;
    BW.measures.pdrTrials = [];

    function median(v) {
        const s = v.slice().sort(function (a, b) {
            return a - b;
        });
        const n = s.length;
        if (n % 2 === 1) {
            return s[(n - 1) / 2];
        }
        return (s[n / 2 - 1] + s[n / 2]) / 2;
    }

    function showTrials() {
        const t = BW.measures.pdrTrials;
        if (t.length === 0) {
            pdrOut.textContent = "";
            return;
        }
        const list = t.map(function (v) {
            return v.toFixed(2);
        }).join(", ");
        if (t.length < TRIALS) {
            pdrOut.textContent = "Trial " + t.length + " of " + TRIALS + ": " + list +
                ". Tap the 4 points again (a new photo is better).";
            return;
        }
        const spread = Math.max.apply(null, t) - Math.min.apply(null, t);
        const m = median(t);
        if (spread > SPREAD_MAX) {
            pdrOut.textContent = "Trials " + list + " do not agree (spread " + spread.toFixed(2) +
                "). Click Start over, hold the finger still, and use the same 4 places.";
            return;
        }
        if (m > 1.0) {
            pdrOut.textContent = "Depth ratio " + m.toFixed(2) + " (3 trials agree within " + spread.toFixed(2) +
                "). This is above 1.0, which is a sign of finger clubbing. Show this to a doctor.";
        } else {
            pdrOut.textContent = "Depth ratio " + m.toFixed(2) + " (3 trials agree within " + spread.toFixed(2) +
                "). This is below 1.0, which is typical (no clubbing sign).";
        }
    }

    function finishPdr() {
        const pdr = dist(pts[0], pts[1]) / dist(pts[2], pts[3]);
        if (pdr < PDR_MIN || pdr > PDR_MAX) {
            pdrOut.textContent = "That ratio (" + pdr.toFixed(2) + ") is not possible for a finger. " +
                "Check the tap order and tap again.";
            pts = [];
            setTimeout(redraw, 600);
            return;
        }
        if (BW.measures.pdrTrials.length >= TRIALS) {
            BW.measures.pdrTrials = [];
        }
        BW.measures.pdrTrials.push(Math.round(pdr * 1000) / 1000);
        showTrials();
        pts = [];
        setTimeout(redraw, 600);
    }

    BW.showPdrTrials = showTrials;

    fFile.addEventListener("change", function () {
        if (!fFile.files[0]) {
            return;
        }
        loadToCanvas(fFile.files[0], fCanvas, function (img) {
            photo = img;
            pts = [];
            fBox.hidden = false;
            redraw();
            showTrials();
        });
    });

    fCanvas.addEventListener("pointerdown", function (e) {
        if (!photo || pts.length >= 4) {
            return;
        }
        pts.push(canvasPoint(fCanvas, e));
        redraw();
        if (pts.length === 4) {
            finishPdr();
        }
    });

    document.getElementById("tap-reset").addEventListener("click", function () {
        pts = [];
        BW.measures.pdrTrials = [];
        showTrials();
        redraw();
    });

    /* C. Nail-bed color */
    const nFile = document.getElementById("nail-file");
    const nCanvas = document.getElementById("nail-canvas");
    const nOut = document.getElementById("nail-result");
    let nailRgb = null;

    function patch(canvas, p) {
        const size = 9;
        const d = canvas.getContext("2d").getImageData(
            Math.max(0, Math.round(p.x) - 4),
            Math.max(0, Math.round(p.y) - 4),
            size,
            size
        ).data;
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

    nFile.addEventListener("change", function () {
        if (!nFile.files[0]) {
            return;
        }
        loadToCanvas(nFile.files[0], nCanvas, function () {
            nCanvas.hidden = false;
            nailRgb = null;
            nOut.textContent = "Tap the middle of one nail bed (the pink part).";
        });
    });

    nCanvas.addEventListener("pointerdown", function (e) {
        const p = canvasPoint(nCanvas, e);
        if (nailRgb === null) {
            nailRgb = patch(nCanvas, p);
            nOut.textContent = "Now tap the white paper.";
            return;
        }
        const paper = patch(nCanvas, p);
        const wb = nailRgb.map(function (c, i) {
            return Math.min(255, c / Math.max(paper[i], 1) * 255);
        });
        const redShare = wb[0] / (wb[0] + wb[1] + wb[2]);
        const pale = redShare < 0.37;
        BW.measures.nailPallor = pale;
        nOut.innerHTML =
            '<span style="display:inline-block;width:18px;height:18px;border-radius:4px;vertical-align:middle;background:rgb(' +
            wb.map(Math.round).join(",") + ')"></span> Red share ' + redShare.toFixed(3) +
            (pale ? " · paler than typical (experimental)." : " · typical color (experimental).");
        nailRgb = null;
    });
})();
