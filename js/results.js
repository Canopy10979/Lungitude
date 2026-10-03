/* Lungitude results page and printable doctor note. */
(function () {
    const PLCO_CUT = 1.51;

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function pct(x) {
        return (x * 100).toFixed(x < 0.01 ? 2 : 1) + "%";
    }

    /* Log scale from 0.1% to 20%, so small and large risks both show. */
    function meterPos(percent) {
        const lo = Math.log(0.1);
        const hi = Math.log(20);
        const v = Math.min(20, Math.max(0.1, percent));
        return ((Math.log(v) - lo) / (hi - lo)) * 100;
    }

    function verdict(d) {
        const r = d.risk;
        if (r.tier === "see_doctor_now") {
            return {
                cls: "urgent",
                eyebrow: "Do not wait for a screening",
                title: "Book a doctor visit this week.",
                body: "You told us about " + r.red_flags.join(", ") + ". A doctor should check these. Screening scans are for people with no symptoms."
            };
        }
        if (r.tier === "screen") {
            const why = r.uspstf.eligible
                ? "You meet the US Preventive Services Task Force guideline for yearly screening."
                : "Your 6-year risk is above the 1.51% level where the model suggests screening.";
            return {
                cls: "",
                eyebrow: "Your next step",
                title: "Ask your doctor for a low-dose CT lung scan.",
                body: why + " The scan takes less than a minute and needs no needles."
            };
        }
        if (r.tier === "not_in_scope") {
            return {
                cls: "calm",
                eyebrow: "Your result",
                title: "Screening guidelines do not cover people who never smoked.",
                body: "Radon gas is the leading cause of lung cancer in people who do not smoke. Test your home for radon, and see a doctor if you have symptoms."
            };
        }
        return {
            cls: "calm",
            eyebrow: "Your result",
            title: "You do not meet screening guidelines today.",
            body: "Your 6-year risk is " + pct(r.risk) + ". The screening level is 1.51%. Check again each year, or if your health changes."
        };
    }

    function riskCard(r) {
        if (r.risk === null) {
            return '<div class="card"><h3>6-year risk</h3><p>The PLCOm2012 model is for people who have smoked. It does not apply to you.</p></div>';
        }
        const p = r.risk * 100;
        return '<div class="card">' +
            "<h3>6-year lung cancer risk</h3>" +
            '<div class="big">' + pct(r.risk) + " <small>PLCOm2012</small></div>" +
            '<div class="meter" role="img" aria-label="Risk ' + pct(r.risk) + '">' +
            '<div class="cut" style="left:' + meterPos(PLCO_CUT) + '%"><span>screen at 1.51%</span></div>' +
            '<div class="mark" style="left:' + meterPos(p) + '%"></div>' +
            "</div>" +
            '<p class="note">About ' + Math.max(1, Math.round(p * 10)) + " in 1,000 people like you get lung cancer in the next 6 years.</p>" +
            "</div>";
    }

    function criteriaCard(r, input) {
        const u = r.uspstf;
        function li(ok, text) {
            return '<li class="' + (ok ? "yes" : "no") + '">' + text + "</li>";
        }
        const quitText = input.smoking_status === "current"
            ? "Still smoking (counts)"
            : "Quit " + input.years_quit + " years ago (must be 15 or less)";
        let medicare = "";
        if (u.eligible && !r.medicare.eligible) {
            medicare = '<p class="note">Medicare covers screening to age 77. Check your plan.</p>';
        }
        if (r.medicare.eligible) {
            medicare = '<p class="note">Medicare and most private plans cover this scan at no cost to you.</p>';
        }
        return '<div class="card">' +
            "<h3>Screening guideline check</h3>" +
            '<ul class="crit">' +
            li(u.age, "Age " + input.age + " (must be 50 to 80)") +
            li(u.pack_years, r.pack_years + " pack-years (must be 20 or more)") +
            li(u.quit_window, quitText) +
            "</ul>" +
            "<p><b>" + (u.eligible ? "You qualify." : "You do not qualify yet.") + "</b></p>" +
            medicare +
            "</div>";
    }

    function driversCard(r) {
        if (!r.drivers.length) {
            return "";
        }
        let max = 0;
        r.drivers.forEach(function (d) {
            max = Math.max(max, Math.abs(d.effect));
        });
        const rows = r.drivers.map(function (d) {
            const mult = Math.exp(d.effect);
            const w = (Math.abs(d.effect) / max) * 50;
            const dir = d.effect > 0 ? "up" : "down";
            return '<div class="row"><span>' + esc(d.label) + '</span>' +
                '<span class="track"><span class="bar ' + dir + '" style="width:' + w + '%"></span></span>' +
                "<b>×" + mult.toFixed(2) + "</b></div>";
        }).join("");

        let whatIf = "";
        const wi = r.what_if || {};
        if (wi.quit_now_in_5y) {
            whatIf = "<h3>Five years from now</h3>" +
                '<div class="whatif">' +
                "<div>If you keep smoking<b>" + pct(wi.keep_smoking_in_5y) + "</b></div>" +
                "<div>If you quit today<b>" + pct(wi.quit_now_in_5y) + "</b></div>" +
                "</div>" +
                '<p class="note">Free help to quit: call 1-800-QUIT-NOW.</p>';
        }
        return '<div class="card wide drivers">' +
            "<h3>What moves your number</h3>" +
            '<p class="note">Compared with a typical 62-year-old who smoked a pack a day for 27 years. Red raises risk. Green lowers it.</p>' +
            rows + whatIf +
            "</div>";
    }

    function bodyCard(r) {
        const b = r.breath;
        const h = r.hands;
        let breath = "<p>Skipped.</p>";
        if (b.fet !== null) {
            const words = { typical: "Typical", long: "Longer than typical", very_long: "Long" };
            breath = '<div class="big">' + b.fet + " s <small>" + words[b.level] + "</small></div>";
            if (r.what_if && r.what_if.if_copd_confirmed) {
                breath += '<p class="note">A long exhale can mean blocked airways (COPD). If a breathing test confirms COPD, your risk becomes ' +
                    pct(r.what_if.if_copd_confirmed) + ".</p>";
            }
        }
        let hands = "<p>Skipped.</p>";
        if (h.pdr_status === "retake") {
            hands = "<p>The finger photo could not be measured. Take it again.</p>";
        }
        if (h.pdr_status === "unsteady") {
            hands = "<p>The 3 finger measurements did not agree (spread " + h.pdr_spread +
                "), so we did not use them. Measure again with the finger held still.</p>";
        }
        if ((h.pdr !== null && h.pdr_status === "ok") || h.schamroth_closed) {
            hands = "<p>";
            if (h.pdr !== null && h.pdr_status === "ok") {
                hands += "Depth ratio <b>" + h.pdr + "</b> (clubbing sign above 1.0)";
                if (h.pdr_repeatable) {
                    hands += ", " + h.pdr_trials.length + " trials within " + h.pdr_spread;
                } else {
                    hands += ", " + h.pdr_trials.length + " trial only";
                }
                hands += ". ";
            }
            if (h.schamroth_closed) {
                hands += "No window in the window test. ";
            }
            hands += h.clubbing_sign ? "<b>Possible clubbing. Show a doctor.</b>" : "No clubbing sign.";
            hands += "</p>";
        }
        if (h.nail_pallor) {
            hands += '<p class="note">Nail beds looked pale (experimental). A blood test (CBC) checks hemoglobin.</p>';
        }
        const v = r.vitals;
        let vitals = "<p>Skipped.</p>";
        if (v.hr !== null || v.spo2 !== null) {
            vitals = "";
            if (v.hr !== null) {
                const hrWords = { normal: "in the usual resting range", fast: "fast for rest (over 100)", slow: "slow (under 50)" };
                vitals += '<div class="big">' + Math.round(v.hr) + " <small>beats per minute, " + hrWords[v.hr_level] + "</small></div>";
            }
            if (v.spo2 !== null) {
                const o2Words = {
                    normal: "in the usual range (95% or more)",
                    borderline: "a little low. Measure again at rest. If it stays below 95%, tell a doctor.",
                    low: "low. See a doctor soon."
                };
                vitals += "<p>Blood oxygen <b>" + v.spo2 + "%</b>: " + o2Words[v.spo2_level] + "</p>";
            }
            vitals += '<p class="note">Pulse and oxygen show how your lungs and heart work today. They do not show cancer.</p>';
        }
        return '<div class="card"><h3>Breath (microphone)</h3>' + breath + "</div>" +
            '<div class="card"><h3>Pulse and oxygen</h3>' + vitals + "</div>" +
            '<div class="card"><h3>Fingers (camera)</h3>' + hands + "</div>";
    }

    function districtCard(region) {
        let html = '<div class="card wide"><h3>Where you live';
        if (region.district) {
            html += ' <span class="tag">' + esc(region.district) + "</span>";
        }
        html += "</h3>";
        if (region.state_screening) {
            const s = region.state_screening;
            html += '<p><span class="big">' + s.rate + "%</span> of people who qualify in " + esc(region.state) +
                " get screened. That ranks " + s.rank + " of " + s.of + ". The US rate is " + s.us_rate + "%.</p>";
        }
        if (region.smoking !== null && region.smoking !== undefined) {
            html += "<p>" + esc(region.county) + ": " + region.smoking + "% of adults smoke";
            if (region.national) {
                html += " (US " + region.national.smoking + "%)";
            }
            html += ", " + region.copd + "% have COPD";
            if (region.national) {
                html += " (US " + region.national.copd + "%)";
            }
            html += ".</p>";
        }
        html += '<p class="note">' + esc(region.source || "") +
            (region.state_screening ? " · " + esc(region.state_screening.source) : "") + "</p></div>";
        return html;
    }

    function radar(places, limit) {
        const c = 150;
        const ringR = 115;
        let svg = '<svg class="radar" viewBox="0 0 300 300" width="300" height="300" role="img" aria-label="Places by walking time">';
        svg += '<circle cx="150" cy="150" r="' + ringR + '" fill="#dcebe8" fill-opacity="0.45" stroke="#0e5c57" stroke-dasharray="4 4"/>';
        svg += '<circle cx="150" cy="150" r="' + ringR / 2 + '" fill="none" stroke="#0e5c57" stroke-opacity="0.4" stroke-dasharray="4 4"/>';
        svg += '<text x="150" y="' + (c - ringR - 6) + '" text-anchor="middle">' + limit + " min walk</text>";
        svg += '<text x="150" y="' + (c - ringR / 2 - 6) + '" text-anchor="middle">' + limit / 2 + " min</text>";
        svg += '<text x="150" y="292" text-anchor="middle">N is up</text>';
        places.forEach(function (p, i) {
            const r = Math.min(p.walk_min / limit, 1.2) * ringR;
            const a = (p.bearing - 90) * Math.PI / 180;
            const x = c + r * Math.cos(a);
            const y = c + r * Math.sin(a);
            const fill = p.kind === "ct" ? "#0e5c57" : "#a8640c";
            svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="11" fill="' + fill + '"/>';
            svg += '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="middle" style="fill:#fff;font-weight:700">' + (i + 1) + "</text>";
        });
        svg += '<circle cx="150" cy="150" r="7" fill="#1a1d21"/><circle cx="150" cy="150" r="13" fill="none" stroke="#1a1d21" stroke-opacity="0.3"/>';
        svg += "</svg>";
        return svg;
    }

    function walkCard(nearby, origin, input, tier, flags) {
        const places = nearby.places.slice(0, 6);
        if (!places.length) {
            return '<div class="card wide"><h3>Places near you</h3><p>No places found. Call 1-800-4-CANCER (National Cancer Institute) for help.</p></div>';
        }
        const list = places.map(function (p, i) {
            const dir = "https://www.google.com/maps/dir/?api=1&origin=" + origin.lat + "," + origin.lon +
                "&destination=" + p.lat + "," + p.lon + "&travelmode=walking";
            const kind = p.kind === "ct" ? "Can do the scan" : "Can order the scan";
            let links = '<a href="' + dir + '" target="_blank" rel="noopener">Walking directions</a>';
            if (p.phone) {
                links += ' · <a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + "</a>";
            }
            if (p.website) {
                links += ' · <a href="' + esc(p.website) + '" target="_blank" rel="noopener">Website</a>';
            }
            const walkable = p.walk_min <= nearby.walk_limit_min;
            return '<div class="place">' +
                '<span class="num ' + p.kind + '">' + (i + 1) + "</span>" +
                "<div><b>" + esc(p.name) + "</b>" + (p.verified ? '<span class="tag">verified</span>' : "") +
                '<br><span class="note">' + kind + (p.address ? " · " + esc(p.address) : "") + "</span><br>" + links + "</div>" +
                '<div class="mins">' + p.walk_min + "<small>" + (walkable ? "min walk" : "min · bus or car") + "</small></div>" +
                "</div>";
        }).join("");

        const status = input.smoking_status === "current" ? "I still smoke" : "I quit " + input.years_quit + " years ago";
        const py = ((input.cigs_per_day / 20) * input.years_smoked).toFixed(0);
        let script = "Hi, I'd like to ask about low-dose CT lung cancer screening. I'm " + input.age +
            ", I have about " + py + " pack-years of smoking history, and " + status +
            ". Do I need a referral, and can you book the screening visit?";
        if (tier === "see_doctor_now") {
            script = "Hi, I'd like an appointment this week, please. I'm " + input.age +
                " and I have " + flags.join(", ") + ". Can a doctor see me soon?";
        }

        return '<div class="card wide"><h3>Places you can walk to' +
            (nearby.sample ? '<span class="tag sample">includes sample data</span>' : "") + "</h3>" +
            '<div class="walk-wrap">' + radar(places, nearby.walk_limit_min) + "<div>" + list + "</div></div>" +
            (input.smoking_status !== "never" || tier === "see_doctor_now" ? "<h3>What to say when you call</h3><p class=\"script\">" + esc(script) + "</p>" : "") +
            '<p class="note">Walk times: ' + (places[0].walk_source === "route" ? "street routes (OpenRouteService)." : "estimated from distance.") +
            " Places: " + ({ google: "Google Places", osm: "OpenStreetMap", sample: "sample data" }[nearby.source] || "OpenStreetMap") + ".</p>" +
            "</div>";
    }

    function doctorNote(d) {
        const r = d.risk;
        const i = d.input;
        const today = new Date().toLocaleDateString();
        const smokingCode = i.smoking_status === "current" ? "F17.210 (nicotine dependence, cigarettes)" : "Z87.891 (history of nicotine dependence)";
        function row(k, v) {
            return "<tr><td>" + k + "</td><td>" + v + "</td></tr>";
        }
        return "<h1>Lung cancer screening: patient summary</h1>" +
            "<p>Prepared by the patient with Lungitude on " + today + ". This is not a diagnosis.</p>" +
            "<table>" +
            row("Age / BMI", i.age + " / " + r.bmi) +
            row("Smoking", i.smoking_status + ", " + r.pack_years + " pack-years" + (i.smoking_status === "former" ? ", quit " + i.years_quit + " years ago" : "")) +
            row("USPSTF 2021 eligible", r.uspstf.eligible ? "Yes" : "No") +
            row("PLCOm2012 6-year risk", r.risk === null ? "Not applicable" : pct(r.risk) + " (screening cutoff 1.51%)") +
            row("Symptoms reported", r.red_flags.length ? r.red_flags.join(", ") : "None") +
            row("Forced expiratory time (phone mic)", r.breath.fet === null ? "Not done" : r.breath.fet + " s") +
            row("Phalangeal depth ratio (phone photo)", r.hands.pdr === null || r.hands.pdr_status !== "ok"
                ? "Not done or not repeatable"
                : r.hands.pdr + " (median of " + r.hands.pdr_trials.join(", ") + ")") +
            row("Heart rate (phone camera PPG)", r.vitals.hr === null ? "Not done" : Math.round(r.vitals.hr) + " bpm, signal " + r.vitals.hr_quality) +
            row("SpO2 (patient's clip-on oximeter)", r.vitals.spo2 === null ? "Not given" : r.vitals.spo2 + "%") +
            row("Schamroth window", r.hands.schamroth_closed ? "Absent (patient report)" : "Present or not done") +
            "</table>" +
            "<h2>Codes that may help</h2>" +
            "<p>CPT 71271: low-dose CT for lung cancer screening. HCPCS G0296: counseling visit for lung cancer screening (Medicare). ICD-10 " + smokingCode + ".</p>" +
            "<p>Phone measurements are not validated clinical tests. Please confirm with standard exams.</p>";
    }

    BW.renderResults = function (d) {
        const v = verdict(d);
        const html =
            '<div class="verdict ' + v.cls + '">' +
            '<p class="eyebrow">' + esc(v.eyebrow) + "</p>" +
            "<h2>" + esc(v.title) + "</h2>" +
            "<p>" + esc(v.body) + "</p>" +
            "</div>" +
            '<div class="cards">' +
            walkCard(d.nearby, d.origin, d.input, d.risk.tier, d.risk.red_flags) +
            riskCard(d.risk) +
            criteriaCard(d.risk, d.input) +
            driversCard(d.risk) +
            bodyCard(d.risk) +
            districtCard(d.region) +
            "</div>" +
            '<div class="actions">' +
            '<button class="btn primary" id="print-note">Print a note for your doctor</button>' +
            '<button class="btn ghost" data-goto="about">Change answers</button>' +
            "</div>" +
            '<div class="card study">' +
            "<h3>Help us test Lungitude</h3>" +
            '<label class="consent"><input type="checkbox" id="study-consent"> ' +
            "Add my numbers to the accuracy study. We save your age range, smoking status, finger ratios, " +
            "exhale time, window test answer, heart rate and blood oxygen. We do not save your name, photos, audio, location or exact age.</label>" +
            '<button class="btn small" id="study-send" disabled>Share my numbers</button>' +
            '<p class="live" id="study-status"></p>' +
            "</div>" +
            '<p class="fineprint">Lungitude is a student project and a screening guide. It does not diagnose cancer. ' +
            "Risk model: Tammemägi et al., NEJM 2013. Guideline: USPSTF 2021.</p>";
        document.getElementById("results").innerHTML = html;
        document.getElementById("doctor-note").innerHTML = doctorNote(d);
        const consent = document.getElementById("study-consent");
        const send = document.getElementById("study-send");
        consent.addEventListener("change", function () {
            send.disabled = !consent.checked;
        });
        send.addEventListener("click", async function () {
            send.disabled = true;
            const status = document.getElementById("study-status");
            try {
                const res = await fetch("api/log.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(Object.assign({ consent: true }, d.input))
                });
                const out = await res.json();
                if (!res.ok) {
                    throw new Error(out.error || "Could not save");
                }
                status.textContent = "Thank you. Your numbers are saved.";
                consent.disabled = true;
            } catch (err) {
                status.textContent = err.message;
                send.disabled = false;
            }
        });
        document.getElementById("print-note").addEventListener("click", function () {
            window.print();
        });
    };
})();
