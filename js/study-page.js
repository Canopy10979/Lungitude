/* study page behavior. */

(function() {
    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (character) {
            return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character];
        });
    }

    function el(id) {
        return document.getElementById(id);
    }

    function tile(value, label) {
        return '<div class="tile"><b>' + esc(value) + "</b><span>" + esc(label) + "</span></div>";
    }

    function fmt(v, digits) {
        if (v === null || v === undefined) {
            return "–";
        }
        return Number(v).toFixed(digits);
    }

    function histogram(bins) {
        const W = 640;
        const H = 220;
        const padL = 30;
        const padB = 28;
        const plotW = W - padL;
        const plotH = H - padB;
        let max = 1;
        bins.forEach(function(b) {
            max = Math.max(max, b.count);
        });
        const bw = plotW / bins.length;
        let svg = '<svg viewBox="0 0 ' + W + " " + H +
            '" role="img" aria-label="Histogram of finger depth ratios">';

        [0, Math.ceil(max / 2), max].forEach(function(t) {
            const y = plotH - (t / max) * (plotH - 10);
            svg += '<line x1="' + padL + '" x2="' + W + '" y1="' + y + '" y2="' + y +
                '" stroke="#dcd8cf" stroke-width="1"/>';
            svg += '<text class="axis" x="' + (padL - 6) + '" y="' + (y + 4) +
                '" text-anchor="end">' + t + "</text>";
        });

        bins.forEach(function(b, i) {
            const h = (b.count / max) * (plotH - 10);
            const x = padL + i * bw + 1;
            const w = bw - 2;
            const y = plotH - h;
            if (b.count > 0) {
                const r = Math.min(4, w / 2, h);
                svg += '<path class="bar" d="M' + x + "," + plotH + " V" + (y + r) +
                    " Q" + x + "," + y + " " + (x + r) + "," + y +
                    " H" + (x + w - r) + " Q" + (x + w) + "," + y + " " + (x + w) + "," + (y +
                    r) +
                    " V" + plotH + ' Z" fill="#0e5c57"/>';
            }
            svg += '<rect class="hit" x="' + (padL + i * bw) + '" y="0" width="' + bw +
                '" height="' + plotH +
                '" fill="transparent" data-i="' + i + '"/>';
            if (i % 2 === 0) {
                svg += '<text class="axis" x="' + (padL + i * bw) + '" y="' + (H - 8) +
                    '" text-anchor="middle">' +
                    b.from.toFixed(2) + "</text>";
            }
        });

        const x1 = padL + ((1.0 - bins[0].from) / 0.05) * bw;
        svg += '<line x1="' + x1 + '" x2="' + x1 + '" y1="0" y2="' + plotH +
            '" stroke="#1a1d21" stroke-width="2" stroke-dasharray="5 4"/>';
        svg += '<text class="axis" x="' + (x1 + 6) +
            '" y="12" style="fill:#1a1d21">clubbing sign above 1.0</text>';
        svg += "</svg>";

        el("hist").innerHTML = svg + '<div class="tip" id="tip" hidden></div>';
        const tip = el("tip");
        el("hist").querySelectorAll("rect.hit").forEach(function(r) {
            r.addEventListener("mousemove", function(e) {
                const b = bins[Number(r.dataset.i)];
                const box = el("hist").getBoundingClientRect();
                tip.hidden = false;
                tip.textContent = b.from.toFixed(2) + "–" + b.to.toFixed(2) + ": " + b
                    .count +
                    (b.count === 1 ? " person" : " people");
                tip.style.left = (e.clientX - box.left) + "px";
                tip.style.top = (e.clientY - box.top) + "px";
            });
            r.addEventListener("mouseleave", function() {
                tip.hidden = true;
            });
        });

        el("hist-table").innerHTML = "<tr><th>Ratio</th><th>People</th></tr>" + bins.map(function(b) {
            return "<tr><td>" + b.from.toFixed(2) + "–" + b.to.toFixed(2) + "</td><td>" + esc(b
                .count) + "</td></tr>";
        }).join("");
    }

    fetch("api/stats.php")
        .then(function(res) {
            return res.json();
        })
        .then(function(s) {
            const r = s.repeatability;
            const pct = r.people_with_3_trials > 0 ? Math.round(100 * r.within_limit / r
                .people_with_3_trials) : null;
            el("summary").textContent = s.people === 0 ?
                "No one has shared numbers yet. Results appear here after people tick the consent box." :
                s.people + (s.people === 1 ? " person" : " people") + " shared their numbers. For " +
                (pct === null ? "–" : pct) +
                "% of them, 3 finger measurements agreed within " + r.limit + ".";
            el("tiles").innerHTML =
                tile(s.people, s.people === 1 ? "person" : "people") +
                tile(pct === null ? "–" : pct + "%", "3 trials agreed within " + r.limit) +
                tile(fmt(r.median_spread, 3), "median spread of 3 trials") +
                tile(s.pdr.above_1, "ratios above 1.0") +
                tile(s.fet_median === null ? "–" : fmt(s.fet_median, 1) + " s", "median exhale time");
            histogram(s.pdr.histogram);
            const ages = Object.keys(s.age_bands);
            el("ages").innerHTML = "<tr><th>Age range</th><th>People</th></tr>" + (ages.length ? ages
                .map(function(k) {
                    return "<tr><td>" + esc(k) + "</td><td>" + esc(s.age_bands[k]) + "</td></tr>";
                }).join("") : '<tr><td colspan="2">No data yet</td></tr>');
        })
        .catch(function() {
            el("summary").textContent = "Could not load the study data.";
        });
})();
