/*
 * Lungitude survey. One question per screen, in this order:
 *   greeting, welcome, name, age, BMI, 7 yes/no symptom questions,
 *   thank you + location, result + 5 places with phone numbers.
 *
 * The name stays in this browser. It is never sent to the server.
 */
(function() {
    const DEMO = {
        lat: 47.7080,
        lon: -122.1830
    };
    const root = document.getElementById("survey");
    const barFill = document.getElementById("bar-fill");

    const state = {
        mood: null,
        name: "",
        age: null,
        bmi: null,
        heightIn: null,
        weightLb: null,
        answers: {},
        loc: null,
        demo: false,
        countyFips: null,
        result: null
    };
    let data = null;
    let counties = {};

    let busy = false;
    let screens = [];
    let index = 0;

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function(c) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            } [c];
        });
    }

    function safeUrl(value) {
        try {
            const url = new URL(value);
            return ["https:", "http:"].includes(url.protocol) ? url.href : "#";
        } catch (error) {
            return "#";
        }
    }

    function fmt(n) {
        if (n === null || n === undefined) {
            return "–";
        }
        return Number(n).toLocaleString("en-US");
    }

    function firstName() {
        if (!state.name) {
            return "";
        }
        return state.name.trim().split(/\s+/)[0];
    }

    function card(inner, opts) {
        const o = opts || {};
        let html = '<section class="q-card">' + inner;
        html += '<div class="q-nav">';
        if (index > 0 && !o.noBack) {
            html += '<button class="btn ghost" data-act="back">Back</button>';
        }
        if (o.next) {
            html += '<button class="btn primary" data-act="next">' + esc(o.next) + "</button>";
        }
        html += "</div></section>";
        return html;
    }

    function setError(msg) {
        const el = root.querySelector(".q-error");
        if (el) {
            el.textContent = msg;
        }
    }

    /* ---------- Screens ---------- */

    function greeting() {
        return {
            render: function() {
                return card(
                    '<p class="q-eyebrow">Lungitude</p>' +
                    '<h1 class="q-title">👋 How are you doing today?</h1>' +
                    '<button class="btn ghost" id="load-demo-person">Load demo person</button>' +
                    '<div class="choices">' + ["Good", "Okay", "Not great"].map(function(m) {
                        return '<button class="choice" data-mood="' + m + '">' + ({Good:'😊 Good',Okay:'😐 Okay','Not great':'💙 Not great'}[m]) +
                            "</button>";
                    }).join("") +
                    "</div>", {
                        noBack: true, next: "Next"
                    }
                );
            },
            bind: function() {
                root.querySelector("#load-demo-person").addEventListener("click", function () {
                    Object.assign(state, {name: "Demo person", age: 63, bmi: null, answers: {lung: true}, loc: DEMO, demo: true, countyFips: null});
                    go(screens.length - 1);
                    finish();
                });
                root.querySelectorAll("[data-mood]").forEach(function(b) {
                    b.addEventListener("click", function() {
                        state.mood = b.dataset.mood;
                        root.querySelectorAll("[data-mood]").forEach(x=>{x.classList.toggle("on",x===b);x.setAttribute("aria-pressed",String(x===b));});
                    });
                });
            },
            next: function(){if(!state.mood)return false;return true;}
        };
    }

    function welcome() {
        return {
            render: function() {
                let reply = "";
                if (state.mood === "Not great") {
                    reply =
                        '<p class="q-reply">Thank you for telling us. This will take about 2 minutes.</p>';
                } else if (state.mood) {
                    reply =
                        '<p class="q-reply">Thank you for checking in. This will take about 2 minutes.</p>';
                }
                return card(
                    reply +
                    '<h1 class="q-title">✨ Understand your symptoms. Find your next step.</h1>' +
                    '<p class="q-motto">Breathing shouldn’t be a tax, make it a right.</p>' +
                    '<p class="q-fine">A two-minute check-in to explore your symptoms and find nearby care.</p>' , {
                        next: "Start"
                    }
                );
            },
            next: function() {
                return true;
            }
        };
    }

    function nameScreen() {
        return {
            render: function() {
                return card(
                    '<label class="q-title" for="q-name">What is your name?</label>' +
                    '<input class="q-input" id="q-name" autocomplete="given-name" maxlength="60" value="' +
                    esc(state.name) + '">' +
                    '<p class="q-fine">Your name stays in this page’s memory and is not included in survey requests.</p>' +
                    '<p class="q-error"></p>', {
                        next: "Next"
                    }
                );
            },
            next: function() {
                const v = root.querySelector("#q-name").value.trim();
                if (v === "") {
                    setError("Please type your name, or a nickname.");
                    return false;
                }
                state.name = v;
                return true;
            }
        };
    }

    function ageScreen() {
        return {
            render: function() {
                return card(
                    '<label class="q-title" for="q-age">How old are you' + (firstName() ? ", " +
                        esc(firstName()) : "") + "?</label>" +
                    '<input class="q-input short" id="q-age" type="number" min="0" max="120" step="1" inputmode="numeric" value="' +
                    (state.age ?? "") + '"> <span class="q-unit">years</span>' +
                    '<p class="q-error"></p>', {
                        next: "Next"
                    }
                );
            },
            next: function() {
                const text = root.querySelector("#q-age").value.trim();
                const v = Number(text);
                if (text === "" || !Number.isInteger(v) || v < 0 || v > 120) {
                    setError("Enter a whole-number age from 0 to 120.");
                    return false;
                }
                state.age = Math.round(v);
                return true;
            }
        };
    }

    function bmiScreen() {
        return {
            render: function() {
                return card(
                    '<label class="q-title" for="q-bmi">What is your BMI? (optional)</label>' +
                    '<input class="q-input short" id="q-bmi" type="number" step="0.1" min="12" max="80" inputmode="decimal" value="' +
                    (state.bmi || "") + '">' +
                    '<details class="q-help"' + (state.heightIn ? " open" : "") +
                    '><summary>I do not know my BMI</summary>' +
                    '<div class="hw">' +
                    '<label>Height <span class="pair"><input id="q-ft" type="number" min="4" max="7" placeholder="ft" inputmode="numeric">' +
                    '<input id="q-in" type="number" min="0" max="11" placeholder="in" inputmode="numeric"></span></label>' +
                    '<label>Weight <span class="pair"><input id="q-lb" type="number" min="60" max="700" placeholder="lb" inputmode="numeric"></span></label>' +
                    "</div></details>" +
                    '<p class="q-live" id="q-bmi-live"></p>' +
                    '<p class="q-error"></p>', {
                        next: "Next"
                    }
                );
            },
            bind: function() {
                function calc() {
                    const ft = Number(root.querySelector("#q-ft").value);
                    const inch = Number(root.querySelector("#q-in").value || 0);
                    const lb = Number(root.querySelector("#q-lb").value);
                    if (ft && lb) {
                        const h = ft * 12 + inch;
                        const bmi = 703 * lb / (h * h);
                        root.querySelector("#q-bmi").value = bmi.toFixed(1);
                        root.querySelector("#q-bmi-live").textContent = "Your BMI is " + bmi.toFixed(
                            1) + ".";
                        state.heightIn = h;
                        state.weightLb = lb;
                    }
                }
                root.querySelectorAll("#q-ft, #q-in, #q-lb").forEach(function(el) {
                    el.addEventListener("input", calc);
                });
            },
            next: function() {
                const text = root.querySelector("#q-bmi").value.trim();
                if (text === "") {
                    state.bmi = null;
                    return true;
                }
                const v = Number(text);
                if (!v || v < 12 || v > 80) {
                    setError("Enter a BMI from 12 to 80, or use height and weight.");
                    return false;
                }
                state.bmi = Math.round(v * 10) / 10;
                return true;
            }
        };
    }

    function symptomScreen(key, number, total) {
        return {
            render: function() {
                const g = data.groups[key];
                const chosen = state.answers[key];
                return card(
                    '<p class="q-eyebrow">Question ' + number + " of " + total + "</p>" +
                    (g.hint ? '<p class="q-hint">' + esc(g.hint) + "</p>" : "") +
                    '<h1 class="q-title">' + esc(g.question) + "</h1>" +
                    '<div class="choices yn">' +
                    '<button class="choice' + (chosen === true ? " on" : "") +
                    '" data-yn="yes">Yes</button>' +
                    '<button class="choice' + (chosen === false ? " on" : "") +
                    '" data-yn="no">No</button>' +
                    '<p class="q-error" role="status"></p></div>', {next:"Next"}
                );
            },
            next: function(){if(typeof state.answers[key]!=="boolean"){setError("Choose Yes or No, then click Next.");return false;}return true;},
            bind: function() {
                root.querySelectorAll("[data-yn]").forEach(function(b) {
                    b.addEventListener("click", function() {
                        state.answers[key] = b.dataset.yn === "yes";
                        root.querySelectorAll("[data-yn]").forEach(x=>{x.classList.toggle("on",x===b);x.setAttribute("aria-pressed",String(x===b));});
                    });
                });
            }
        };
    }

    function thanks() {
        return {
            render: function() {
                return card(
                    '<h1 class="q-title">📍 Thanks for checking in' +
                    (firstName() ? ", " + esc(firstName()) : "") + ".</h1>" +
                    "<p>Choose your Washington county for local cancer information, or share your location to also find nearby care.</p>" +
                    '<label for="q-county">Your county</label><select id="q-county" class="q-input"><option value="">Choose a county</option>' +
                    Object.keys(counties).map(function(f) {
                        return '<option value="' + f + '">' + esc(counties[f]) + '</option>';
                    }).join('') +
                    '</select><button class="btn primary" id="q-county-go">Use this county</button>' +
                    '<div class="zip-row"><input class="q-input" id="q-zip" inputmode="numeric" maxlength="5" placeholder="US ZIP code" aria-label="ZIP code"><button class="btn" id="q-zip-go">Use ZIP code</button></div>' +
                    '<p class="q-fine">A ZIP code uses an approximate area center. GPS gives a more precise nearby search.</p>' +
                    '<div class="choices stack">' +
                    '<button class="btn primary" id="q-loc">Use my location</button>' +
                    '<button class="btn ghost" id="q-demo">Use demo location (Kirkland, WA)</button>' +
                    "</div>" +
                    '<p class="q-live" id="q-status"></p>'
                );
            },
            bind: function() {
                root.querySelector("#q-zip-go").addEventListener("click", async function() {
                    const zip = root.querySelector("#q-zip").value.trim();
                    const status = root.querySelector("#q-status");
                    if (!/^\d{5}$/.test(zip)) {
                        status.textContent = "Enter a five-digit ZIP code.";
                        return;
                    }
                    status.textContent = "Looking up your ZIP code…";
                    try {
                        const loc = await getJson("api/zipcode.php?zip=" + zip);
                        state.loc = {
                            lat: loc.lat,
                            lon: loc.lon
                        };
                        state.countyFips = null;
                        state.demo = false;
                        finish();
                    } catch (err) {
                        status.textContent = err.message;
                    }
                });
                root.querySelector("#q-county-go").addEventListener("click", function() {
                    const f = root.querySelector("#q-county").value;
                    if (!f) {
                        root.querySelector("#q-status").textContent =
                        "Choose a county first.";
                        return;
                    }
                    state.countyFips = f;
                    state.loc = null;
                    state.demo = false;
                    finish();
                });
                root.querySelector("#q-demo").addEventListener("click", function() {
                    state.countyFips = null;
                    state.loc = DEMO;
                    state.demo = true;
                    finish();
                });
                root.querySelector("#q-loc").addEventListener("click", function() {
                    const status = root.querySelector("#q-status");
                    if (!navigator.geolocation) {
                        status.textContent =
                            "This browser cannot share location. Use the demo location.";
                        return;
                    }
                    status.textContent = "Waiting for your location…";
                    navigator.geolocation.getCurrentPosition(function(pos) {
                        state.countyFips = null;
                        state.loc = {
                            lat: Number(pos.coords.latitude.toFixed(5)),
                            lon: Number(pos.coords.longitude.toFixed(5))
                        };
                        state.demo = false;
                        finish();
                    }, function() {
                        status.textContent =
                            "Location was blocked. Use the demo location.";
                    }, {
                        timeout: 10000
                    });
                });
            }
        };
    }

    /* ---------- Result ---------- */

    async function getJson(url, options) {
        const res = await fetch(url, Object.assign({}, options, {
            signal: AbortSignal.timeout(25000)
        }));
        const out = await res.json();
        if (!res.ok) {
            throw new Error(out.error || "Request failed");
        }
        return out;
    }

    function placesUrl(type) {
        return "api/nearby.php?type=" + encodeURIComponent(type) + "&limit=5&lat=" + Number(state.loc.lat) +
            "&lon=" + Number(state.loc.lon);
    }

    async function finish() {
        if (busy)
            return;
        busy = true;
        const status = root.querySelector("#q-status");
        status.textContent = "Preparing your cancer information…";
        root.querySelectorAll("button").forEach(function(b) {
            b.disabled = true;
        });
        try {
            const result = await getJson("api/survey.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    age: state.age,
                    bmi: state.bmi,
                    answers: state.answers,
                    lat: state.loc ? state.loc.lat : null,
                    lon: state.loc ? state.loc.lon : null,
                    county_fips: state.countyFips || undefined,
                    demo: state.demo
                })
            });
            state.result = result;
            renderResult(result, {
                places: [],
                source: state.loc ? "pending" : "none"
            });
            if (state.loc) {
                try {
                    const places = await getJson(placesUrl(result.place_key));
                    root.querySelector("#places").innerHTML = placesBlock(places);
                } catch (error) {
                    root.querySelector("#places").textContent =
                        error.message;
                }
            }

        } catch (err) {
            status.textContent = "Could not prepare your results. " + err.message;
        } finally {
            busy = false;
            root.querySelectorAll("button").forEach(function(b) {
                b.disabled = false;
            });
        }
    }

    function rateLine(c) {
        if (!Number.isFinite(c.rate_wa) || !Number.isFinite(c.rate_us)) {
            return "";
        }
        const diff = c.rate_wa - c.rate_us;
        let word = "about the same as";
        if (diff / c.rate_us > 0.05) {
            word = "higher than";
        }
        if (diff / c.rate_us < -0.05) {
            word = "lower than";
        }
        return "Washington: " + c.rate_wa + " new cases per 100,000 people a year, " + word +
            " the US (" + c.rate_us + ").";
    }

    function rateBar(c) {
        if (!Number.isFinite(c.rate_wa) || !Number.isFinite(c.rate_us))
            return "";
        const max = Math.max(c.rate_wa, c.rate_us) * 1.15;
        return '<div class="ratebar" role="img" aria-label="Washington ' + c.rate_wa + ", US " + c
            .rate_us + ' per 100,000">' +
            '<span class="rb-label">WA</span><span class="rb-track"><span class="rb-fill wa" style="width:' +
            (c.rate_wa / max * 100) + '%"></span></span><span class="rb-val">' + c.rate_wa + "</span>" +
            '<span class="rb-label">US</span><span class="rb-track"><span class="rb-fill us" style="width:' +
            (c.rate_us / max * 100) + '%"></span></span><span class="rb-val">' + c.rate_us + "</span>" +
            "</div>";
    }

    function groupCard(m, r) {
        let html = '<div class="g-card"><h3>' + esc(m.label) + "</h3>";
        m.cancers.forEach(function(c) {
            html += '<div class="cancer"><b>' + esc(c.name) + "</b>";
            if (c.new_2026) {
                html += "<p>About <b>" + fmt(c.new_2026) +
                    "</b> new cases are estimated for Washington in 2026 (ACS)" +
                    (c.deaths_2026 ? ", and about " + fmt(c.deaths_2026) + " will die from it." :
                        ".") + "</p>";
            } else if (c.deaths_2026) {
                html += "<p>About " + fmt(c.deaths_2026) +
                    " people in Washington will die from it in 2026.</p>";
            }
            html += "<p class=\"note\">" + rateLine(c) + "</p>" + rateBar(c);
            if (c.county_rate && r.county) {
                html += '<p class="note"><b>' + esc(r.county.name) + ":</b> " + c.county_rate
                    .rate + " per 100,000" +
                    (c.county_rate.count ? ", about " + fmt(c.county_rate.count) +
                        " cases a year" : "") +
                    (c.county_rate.years ? " (" + esc(c.county_rate.years) + ")" : "") + ".</p>";
            }
            if (!c.county_rate)
                html +=
                '<p class="data-empty">County incidence unavailable for this cancer. State figures above are population context.</p>';
            html += "</div>";
        });
        if (m.bmi_linked && r.bmi) {
            html += '<p class="flag">Your BMI (' + esc(r.bmi.bmi) + ") is in the " + esc(r.bmi.category) +
                " range. The CDC links overweight and obesity to this cancer" + (m.bmi_note ? " (" + esc(m
                    .bmi_note) + ")" : "") + ".</p>";
        }
        html += "<p><b>Who to see:</b> " + esc(m.specialist) + ".</p>";
        if (m.key === "lung") {
            html += '<p><a class="btn small" href="lung.html">Do the 3-minute lung check</a> ' +
                '<span class="note">It uses your microphone and camera, and checks if you qualify for a lung scan.</span></p>';
        }
        return html + "</div>";
    }

    function countyCard(r) {
        const c = r.county;
        if (!c) {
            return "";
        }
        let html = '<div class="g-card"><h3>Your county: ' + esc(c.name) + "</h3>";
        if (!c.in_wa) {
            html +=
                "<p>Your location is outside Washington. The state figures are Washington context and do not describe your local area.</p>";
        }
        const st = c.stats;
        const items = [];
        if (st && st.verified === true && st.year) {
            if (st.smoking !== null && st.smoking !== undefined) {
                items.push(st.smoking + "% of adults smoke");
            }
            if (st.obesity !== null && st.obesity !== undefined) {
                items.push(st.obesity + "% of adults have obesity");
            }
            if (st.colon_screen !== null && st.colon_screen !== undefined) {
                items.push(st.colon_screen + "% of adults are up to date on colorectal screening");
            }
            if (st.mammogram !== null && st.mammogram !== undefined) {
                items.push(st.mammogram + "% of women had a recent mammogram");
            }
        }
        if (items.length) {
            html += "<ul>" + items.map(function(t) {
                return "<li>" + esc(t) + "</li>";
            }).join("") + '</ul><p class="note">' + esc(st.source || "CDC PLACES") + " · " + esc(st.year) + "</p>";
        } else {
            html +=
                '<p class="note">Local prevention statistics are unavailable.</p>';
        }
        return html + "</div>";
    }

    function placesBlock(places) {
        if (!state.loc)
            return "<p>County selected. Share your location by starting again to find care near you.</p>";
        if (places.source === "pending")
            return '<p role="status">Finding nearby care…</p>';
        const list = places.places.slice(0, 5);
        if (places.source !== "google") return '<p>Search Google Maps using your location to find nearby clinics.</p>';
        if (list.length === 0) {
            return "<p>Google returned no healthcare places within 10 miles of this location. Call 1-800-4-CANCER (National Cancer Institute) for help.</p>";
        }
        let html =
            '<p class="note">📍 Within 10 miles · nearest first · call to confirm services.</p>';
        html += '<ol class="centers">';
        list.forEach(function(p) {
            const dir = "https://www.google.com/maps/dir/?api=1&origin=" + Number(state.loc.lat) + "," +
                Number(state.loc.lon) +
                "&destination=" + Number(p.lat) + "," + Number(p.lon) + "&travelmode=" + (p.walk_min <= 20 ?
                    "walking" : "driving");
            const time = p.walk_min <= 20 ? p.walk_min + " min walk" : "about " + p.drive_min +
                " min by car";
            html += "<li><b>" + esc(p.name) + "</b>" + (p.verified ?
                    ' <span class="tag">Listed location</span>' : "") +
                '<br><span class="note">' + esc(p.address || "") + (p.address ? " · " : "") +
                Number(p.miles).toFixed(2) + " miles away · " + esc(time) + "</span>" +
                ' · <a href="' + dir + '" target="_blank" rel="noopener">Directions</a></li>';
        });
        html += "</ol><h3>Phone #s:</h3><ol class=\"phones\">";
        list.forEach(function(p) {
            html += "<li>" + (p.phone ?
                    '<a href="tel:' + esc(p.phone.replace(/[^0-9+]/g, "")) + '">' + esc(p.phone) +
                    "</a>" :
                    '<span class="note">No phone listed. ' + (p.website ? '<a href="' + esc(
                            safeUrl(p.website)) + '" target="_blank" rel="noopener">Website</a>' :
                        "Use Directions to find it.") + "</span>") +
                ' <span class="note">(' + esc(p.name) + ")</span></li>";
        });
        html += "</ol>";
        const src = {
            google: "Google Maps",
            osm: "OpenStreetMap",
            sample: "sample data"
        } [places.source] || "";
        html += '<p class="note">Places: ' + src + ".</p>";
        return html;
    }

    function renderResult(r, places) {
        barFill.style.width = "100%";
        document.getElementById("stage-label").textContent = "YOUR NEXT STEPS";
        const name = firstName();
        const urgent = r.matched.filter(function(m) {
            return m.urgent_sign;
        });
        let headline = r.matched.length === 0 ? "Your screening and prevention overview" :
            "Symptoms worth discussing with a clinician";

        let html =
            '<section class="result"><div class="result-summary"><span>YOUR PERSONALIZED OVERVIEW</span><div><b>' +
            esc(r.county ? r.county.name : 'County unavailable') + '</b><b>Age ' + esc(r.age) + '</b><b>' + (
                state.demo ? 'Demo location' : 'Selected location') + '</b></div></div>';
        html += '<p class="q-eyebrow">' + (name ? esc(name) + ", here" : "Here") + " is your result</p>";
        html += '<h1 class="q-title"><span class="r-main">' + esc(headline) + "</span></h1>";

        if (r.matched.length > 0) {
            html +=
                '<p class="r-note">🗓️ Book a visit to discuss the symptoms you reported.</p>' ;
            if (urgent.length > 0) {
                html += '<p class="r-urgent">If you have ' + urgent.map(function(m) {
                    return esc(m.urgent_sign);
                }).join(" or ") + ", contact a clinician promptly for guidance.</p>";
            }
            if (r.many) {
                html += "<p>You said yes in " + r.matched.length +
                    " areas. Start with a <b>primary care doctor</b>, who can check everything in one visit.</p>";
            }
        } else {
            html +=
                '<p class="r-note">You reported no symptoms in these categories. Explore your screening options below.</p>' ;
        }

        html += '<nav class="result-flow" aria-label="Your results"><a href="#care-next">📍 Nearby care</a><a href="#screening-next">🗓️ Screenings</a><a href="#context-next">📖 Local context</a></nav>';
        html += '<section class="result-section" id="care-next"><h2>📍 Find your next appointment</h2>';
        html += '<div id="places">' + placesBlock(places) + "</div></section>";

        if (r.matched.length > 0) {
            html += "<h2>💬 Information related to your answers</h2>";
            html += '<div class="g-grid">' + r.matched.map(function(m) {
                return groupCard(m, r);
            }).join("") + "</div>";
        }


        html += '<section class="result-section" id="screening-next"><h2>🗓️ Screening options at age ' + esc(r.age) + "</h2>";
        if (r.screenings_due.length === 0) {
            html +=
                "<p>No age-based screening options are listed here for your age. Ask your doctor about your own risk.</p>";
        } else {
            html += '<ul class="screens">' + r.screenings_due.map(function(s) {
                return "<li><b>" + esc(s.name) + "</b> <span class=\"note\">(" + esc(s.who) +
                    ", age " + esc(s.from) + "–" + esc(s.to) + ")</span><br>" +
                    esc(s.how) + " · " + esc(s.grade) + (s.key === "lung" ?
                        ' · <a href="lung.html">Check if you qualify</a>' : "") + "</li>";
            }).join("") + "</ul>";
        }

        html += '</section><section class="result-section" id="context-next"><h2>📖 Your local context</h2>' + countyCard(r);
        if (r.bmi) {
            html += '<div class="g-card"><h3>Your BMI: ' + esc(r.bmi.bmi) + " (" + esc(r.bmi.category) +
                ")</h3>";
            if (r.bmi.cancer_link) {
                html +=
                    "<p>Body weight is one factor in your overall health.</p>";
            } else {
                html +=
                    "<p>Your BMI: one part of your health overview.</p>";
            }
            html += "</div>";
        }

        if (r.free_screening) {
            const f = r.free_screening;
            html += '<div class="g-card free"><h3>Screening assistance in Washington</h3><p>The <b>' +
                esc(f.name) + "</b> offers screening assistance. " +
                esc(f.ages) + ". " + esc(f.who) + '.</p><p>Contact: ' + esc(f.contact) + ' · <a href="' +
                esc(f.url) + '" target="_blank" rel="noopener">More information</a></p></div>';
        }

        html += '</section><details class="g-card source-details"><summary>📚 Sources</summary><p>' + Object.values(r.sources).map(esc).join(' · ') + '</p></details>';
        html += '<p><a href="lung.html">🫁 Explore the lung screening check →</a></p>';
        html +=
            '<div class="q-nav"><button class="btn ghost" data-act="restart">Start again</button></div>';
        html += "</section>";
        root.innerHTML = html;
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        root.querySelectorAll("[data-type]").forEach(function(b) {
            b.addEventListener("click", async function() {
                root.querySelectorAll("[data-type]").forEach(function(x) {
                    x.classList.toggle("on", x === b);
                });
                const box = root.querySelector("#places");
                box.innerHTML = '<p class="note">Searching…</p>';
                try {
                    box.innerHTML = placesBlock(await getJson(placesUrl(b.dataset
                        .type)));
                } catch (err) {
                    box.innerHTML = "<p>Could not load places: " + esc(err.message) +
                        "</p>";
                }
            });
        });
        root.querySelector('[data-act="restart"]').addEventListener("click", function() {
            Object.assign(state, {
                mood: null,
                name: "",
                age: null,
                bmi: null,
                heightIn: null,
                weightLb: null,
                answers: {},
                loc: null,
                countyFips: null,
                demo: false,
                result: null
            });
            go(0);
        });
    }

    /* ---------- Flow ---------- */

    function go(i) {
        document.getElementById("stage-label").textContent = "YOUR CHECK-IN";
        index = Math.max(0, Math.min(screens.length - 1, i));
        const s = screens[index];
        root.innerHTML = s.render();
        root.classList.remove("step-enter");void root.offsetWidth;root.classList.add("step-enter");
        barFill.style.width = Math.round(index / screens.length * 100) + "%";
        const nextBtn = root.querySelector('[data-act="next"]');
        if (nextBtn) {
            nextBtn.addEventListener("click", function() {
                if (s.next && s.next()) {
                    go(index + 1);
                }
            });
        }
        const backBtn = root.querySelector('[data-act="back"]');
        if (backBtn) {
            backBtn.addEventListener("click", function() {
                go(index - 1);
            });
        }
        const input = root.querySelector("input.q-input");
        if (input) {
            input.focus();
            input.addEventListener("keydown", function(e) {
                if (e.key === "Enter" && nextBtn) {
                    nextBtn.click();
                }
            });
        }
        if (s.bind) {
            s.bind();
        }
    }

    window.LungitudeSurvey = state;
    window.addEventListener('lungitude-auth-change',event=>{
        if(event.detail?.user?.name && !state.name){
            state.name=event.detail.user.name;
            const input=root.querySelector('#q-name');if(input&&!input.value)input.value=state.name;
        }
    });


    Promise.all([getJson("data/wa_cancers.json"), getJson("data/wa_counties.json")])
        .then(function(values) {
            const d = values[0];
            counties = values[1];

            data = d;
            screens = [greeting(), welcome(), nameScreen(), ageScreen(), bmiScreen()];
            d.order.forEach(function(key, i) {
                screens.push(symptomScreen(key, i + 1, d.order.length));
            });
            screens.push(thanks());
            go(0);
        })
        .catch(function() {
            root.innerHTML =
                '<p class="q-error">Could not load the survey. Run the app with php -S localhost:8000.</p>';
        });
})();
