/* Lungitude: flow, form state and API calls. Vanilla JS, no build step. */

window.BW = {
    measures: {
        fet: null,
        pdrTrials: [],
        nailPallor: false
    },
    location: null,
    demoLocation: { lat: 47.7080, lon: -122.1830, label: "Kirkland, WA (WA-01)" }
};

(function () {
    const STEPS = ["about", "smoking", "history", "breath", "hands", "place"];

    function $(sel) {
        return document.querySelector(sel);
    }

    function field(name) {
        return document.querySelector('[name="' + name + '"]');
    }

    function num(name) {
        const el = field(name);
        if (!el || el.value === "") {
            return null;
        }
        return Number(el.value);
    }

    function checked(name) {
        const el = field(name);
        return !!(el && el.checked);
    }

    function radio(name) {
        const el = document.querySelector('[name="' + name + '"]:checked');
        if (!el) {
            return null;
        }
        return el.value;
    }

    BW.go = function (step) {
        document.querySelectorAll(".step").forEach(function (s) {
            s.removeAttribute("data-active");
        });
        $("#step-" + step).setAttribute("data-active", "");
        const idx = STEPS.indexOf(step);
        document.querySelectorAll(".progress li").forEach(function (li, i) {
            li.classList.toggle("done", idx > i || step === "results");
            li.classList.toggle("now", idx === i);
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    function heightIn() {
        const ft = num("height_ft");
        const inch = num("height_inch") || 0;
        if (ft === null) {
            return null;
        }
        return ft * 12 + inch;
    }

    function validate(step) {
        if (step === "about") {
            const age = num("age");
            if (age === null || age < 18 || age > 100) {
                return "Enter an age from 18 to 100.";
            }
            if (!heightIn() || heightIn() < 48) {
                return "Enter your height.";
            }
            if (num("weight_lb") === null || num("weight_lb") < 60) {
                return "Enter your weight.";
            }
        }
        if (step === "smoking") {
            const status = radio("smoking_status");
            if (status === null) {
                return "Choose one answer.";
            }
            if (status !== "never" && (!num("cigs_per_day") || num("years_smoked") === null)) {
                return "Enter cigarettes per day and years smoked.";
            }
            if (status === "former" && num("years_quit") === null) {
                return "Enter how many years ago you quit.";
            }
        }
        return null;
    }

    function updateReadouts() {
        const h = heightIn();
        const w = num("weight_lb");
        if (h && w) {
            const bmi = 703 * w / (h * h);
            $("#bmi-readout").textContent = "BMI " + bmi.toFixed(1);
        }

        const status = radio("smoking_status");
        $("#smoking-detail").style.display = status === "never" ? "none" : "";
        $("#quit-field").style.display = status === "former" ? "" : "none";

        const cpd = num("cigs_per_day");
        const yrs = num("years_smoked");
        if (status !== "never" && cpd && yrs) {
            const py = (cpd / 20) * yrs;
            let text = "= " + py.toFixed(1) + " pack-years";
            if (py >= 20) {
                text += " (screening guidelines start at 20)";
            }
            $("#pack-readout").textContent = text;
        } else {
            $("#pack-readout").textContent = "";
        }
    }

    function collect() {
        const status = radio("smoking_status") || "never";
        return {
            age: num("age"),
            height_in: heightIn(),
            weight_lb: num("weight_lb"),
            education: num("education"),
            race: field("race").value,
            smoking_status: status,
            cigs_per_day: status === "never" ? 0 : num("cigs_per_day"),
            years_smoked: status === "never" ? 0 : num("years_smoked"),
            years_quit: status === "former" ? num("years_quit") : 0,
            copd: checked("copd"),
            personal_cancer: checked("personal_cancer"),
            family_lung_cancer: checked("family_lung_cancer"),
            cough_blood: checked("cough_blood"),
            weight_loss: checked("weight_loss"),
            hoarse: checked("hoarse"),
            long_cough: checked("long_cough"),
            fet: BW.measures.fet,
            pdr_trials: BW.measures.pdrTrials || [],
            hr: BW.measures.pulse ? BW.measures.pulse.hr : null,
            hr_quality: BW.measures.pulse ? BW.measures.pulse.quality : null,
            perfusion: BW.measures.pulse ? BW.measures.pulse.perfusion : null,
            spo2: num("spo2"),
            schamroth_closed: radio("schamroth") === "closed",
            nail_pallor: BW.measures.nailPallor
        };
    }

    async function getJson(url, options) {
        const res = await fetch(url, options);
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Request failed");
        }
        return data;
    }

    async function finish(loc, demo) {
        const status = $("#place-status");
        status.textContent = "Finding your county and places you can walk to…";
        const input = collect();
        const q = "lat=" + loc.lat + "&lon=" + loc.lon + (demo ? "&demo=1" : "");
        try {
            const results = await Promise.all([
                getJson("api/risk.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(input)
                }),
                getJson("api/region.php?" + q),
                getJson("api/nearby.php?" + q)
            ]);
            BW.renderResults({
                input: input,
                risk: results[0],
                region: results[1],
                nearby: results[2],
                origin: loc
            });
            status.textContent = "";
            BW.go("results");
        } catch (err) {
            status.textContent = "Something went wrong: " + err.message;
        }
    }

    function loadDemoPerson() {
        const values = {
            age: 63,
            height_ft: 5,
            height_inch: 9,
            weight_lb: 172,
            education: 2,
            cigs_per_day: 20,
            years_smoked: 38,
            years_quit: 4
        };
        Object.keys(values).forEach(function (k) {
            field(k).value = values[k];
        });
        document.querySelector('[name="smoking_status"][value="former"]').checked = true;
        field("family_lung_cancer").checked = true;
        BW.measures.fet = 7.4;
        BW.measures.pdrTrials = [0.93, 0.95, 0.92];
        BW.measures.pulse = { hr: 76, quality: "good", perfusion: 1.4 };
        field("spo2").value = 96;
        document.getElementById("pulse-result").textContent = "Demo value: heart rate 76 beats per minute (signal good).";
        $("#breath-result").textContent = "Demo value: 7.4 seconds";
        BW.showPdrTrials();
        updateReadouts();
        BW.go("about");
    }

    document.addEventListener("click", function (e) {
        const go = e.target.closest("[data-goto]");
        if (go) {
            e.preventDefault();
            BW.go(go.dataset.goto);
            return;
        }
        const next = e.target.closest("[data-next]");
        if (next) {
            const current = next.closest(".step").id.replace("step-", "");
            const problem = validate(current);
            if (problem) {
                alert(problem);
                return;
            }
            BW.go(next.dataset.next);
        }
    });

    document.addEventListener("input", updateReadouts);
    document.addEventListener("change", updateReadouts);

    $("#load-demo").addEventListener("click", loadDemoPerson);

    $("#use-demo-location").addEventListener("click", function () {
        BW.location = BW.demoLocation;
        finish(BW.demoLocation, true);
    });

    $("#use-location").addEventListener("click", function () {
        if (!navigator.geolocation) {
            $("#place-status").textContent = "This browser cannot share location. Use the demo location.";
            return;
        }
        $("#place-status").textContent = "Waiting for your location…";
        navigator.geolocation.getCurrentPosition(
            function (pos) {
                const loc = {
                    lat: Number(pos.coords.latitude.toFixed(5)),
                    lon: Number(pos.coords.longitude.toFixed(5)),
                    label: "Your location"
                };
                BW.location = loc;
                finish(loc, false);
            },
            function () {
                $("#place-status").textContent = "Location was blocked. Use the demo location.";
            },
            { timeout: 10000 }
        );
    });

    updateReadouts();
})();
