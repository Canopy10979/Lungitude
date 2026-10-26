(function () {
    "use strict";

    const storageKey = "lungitude.activity.v1";
    const counters = {
        surveys: 0,
        researchScans: 0
    };
    let storage = null;

    try {
        storage = window.localStorage;
        const saved = JSON.parse(storage.getItem(storageKey) || "{}");
        if (Number.isSafeInteger(saved.surveys) && saved.surveys >= 0) {
            counters.surveys = saved.surveys;
        }
        if (Number.isSafeInteger(saved.researchScans) && saved.researchScans >= 0) {
            counters.researchScans = saved.researchScans;
        }
    } catch (error) {
        storage = null;
    }

    function updatePanel() {
        const surveys = document.getElementById("activity-surveys");
        const scans = document.getElementById("activity-scans");
        const saveNote = document.getElementById("activity-save-note");
        if (surveys) {
            surveys.textContent = String(counters.surveys);
        }
        if (scans) {
            scans.textContent = String(counters.researchScans);
        }
        if (saveNote) {
            saveNote.textContent = storage
                ? "Saved in this browser."
                : "Browser storage is unavailable. Counts last only while this page stays open.";
        }
    }

    function createPanel() {
        if (document.getElementById("activity-surveys")) {
            return;
        }
        const host = document.getElementById("engagement-card");
        if (!host || typeof document.createElement !== "function") {
            return;
        }

        const panel = document.createElement("section");
        panel.className = "capture-card activity-panel";
        panel.setAttribute("aria-labelledby", "activity-title");
        const title = document.createElement("h3");
        title.id = "activity-title";
        title.textContent = "Your activity";
        const totals = document.createElement("dl");
        for (const [id, label] of [
            ["activity-surveys", "Survey completions"],
            ["activity-scans", "Completed research scans"]
        ]) {
            const entry = document.createElement("div");
            const term = document.createElement("dt");
            term.textContent = label;
            const value = document.createElement("dd");
            value.id = id;
            value.textContent = "0";
            entry.append(term, value);
            totals.append(entry);
        }
        const note = document.createElement("p");
        note.textContent = "Totals stay in this browser. A survey or photo capture is not an AI scan.";
        const saveNote = document.createElement("p");
        saveNote.id = "activity-save-note";
        saveNote.setAttribute("role", "status");
        const resetButton = document.createElement("button");
        resetButton.id = "activity-reset";
        resetButton.type = "button";
        resetButton.className = "button subtle";
        resetButton.textContent = "Reset activity";
        panel.append(title, totals, note, saveNote, resetButton);
        host.append(panel);
    }

    function persist() {
        if (!storage) {
            return;
        }
        try {
            storage.setItem(storageKey, JSON.stringify(counters));
        } catch (error) {
            storage = null;
        }
    }

    function record(kind) {
        if (kind === "survey") {
            counters.surveys += 1;
        } else if (kind === "researchScan") {
            counters.researchScans += 1;
        } else {
            return;
        }
        persist();
        updatePanel();
    }

    function reset() {
        counters.surveys = 0;
        counters.researchScans = 0;
        if (storage) {
            try {
                storage.removeItem(storageKey);
            } catch (error) {
                storage = null;
            }
        }
        updatePanel();
    }

    function successfulResult(response, url) {
        if (!response.ok) {
            return;
        }
        return response.clone().json().then(function (result) {
            let parsedUrl;
            try {
                parsedUrl = new URL(url, window.location.href);
            } catch (error) {
                return;
            }
            if (parsedUrl.origin !== window.location.origin) {
                return;
            }
            if (parsedUrl.pathname.endsWith("/api/survey.php")) {
                if (result.demo !== true && typeof result.place_key === "string" && Array.isArray(result.matched)) {
                    record("survey");
                }
                return;
            }
            if (!parsedUrl.pathname.endsWith("/api/imaging.php")) {
                return;
            }
            const action = parsedUrl.searchParams.get("action");
            if (
                action === "features"
                && Array.isArray(result.shape && result.shape.axis_asymmetry)
                && Number.isFinite(result.shape.circularity)
                && Number.isFinite(result.shape.area_pixels)
                && Array.isArray(result.color && result.color.rgb_std)
                && Number.isFinite(result.texture && result.texture.glcm_contrast)
            ) {
                record("researchScan");
            }
            if (
                action === "infer"
                && typeof result.architecture === "string"
                && result.scores
                && Object.values(result.scores).some(Number.isFinite)
            ) {
                record("researchScan");
            }
            if (
                action === "infer_all"
                && result.models
                && Object.values(result.models).some(function (model) {
                    return model
                        && model.available === true
                        && model.probabilities
                        && Object.values(model.probabilities).some(Number.isFinite);
                })
            ) {
                record("researchScan");
            }
        }).catch(function () {
            return undefined;
        });
    }

    function observeSuccessfulRequests() {
        const originalFetch = window.fetch;
        if (typeof originalFetch !== "function") {
            return;
        }
        window.fetch = async function (input, options) {
            const requestUrl = typeof input === "string" || input instanceof URL
                ? String(input)
                : input.url;
            const response = await originalFetch.apply(this, arguments);
            if (response.ok && requestUrl) {
                await successfulResult(response, requestUrl);
            }
            return response;
        };
    }

    window.LungitudeActivity = {
        record: record,
        reset: reset,
        getCounts: function () {
            return {
                surveys: counters.surveys,
                researchScans: counters.researchScans
            };
        }
    };

    createPanel();
    const resetButton = document.getElementById("activity-reset");
    if (resetButton) {
        resetButton.addEventListener("click", reset);
    }
    updatePanel();
    observeSuccessfulRequests();
}());
