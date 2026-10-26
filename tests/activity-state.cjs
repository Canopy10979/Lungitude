"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function makeElement(id) {
    const listeners = {};
    return {
        id,
        textContent: "",
        attributes: {},
        listeners,
        addEventListener(name, callback) {
            listeners[name] = callback;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        dispatch(name) {
            listeners[name]?.();
        }
    };
}

function makeResponse(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        json: async () => data,
        clone() {
            return makeResponse(data, status);
        }
    };
}

function loadActivity(fetch) {
    const elements = Object.fromEntries([
        "activity-surveys",
        "activity-scans",
        "activity-save-note",
        "activity-reset"
    ].map((id) => [id, makeElement(id)]));
    const values = new Map();
    const storage = {
        getItem: (key) => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key)
    };
    const window = {
        localStorage: storage,
        location: new URL("https://lungitude.test/index.html"),
        fetch
    };
    const document = {
        getElementById: (id) => elements[id] || null
    };
    const context = vm.createContext({ document, URL, window });
    const source = fs.readFileSync(path.join(root, "js", "activity.js"), "utf8");
    vm.runInContext(source, context);
    return { elements, window, activity: window.LungitudeActivity };
}

test("activity counts only completed first-party surveys and research scans", async () => {
    const instance = loadActivity(async (input) => {
        const url = new URL(input, "https://lungitude.test");
        if (url.pathname.endsWith("/api/survey.php")) {
            return makeResponse({
                demo: url.searchParams.has("demo"),
                place_key: "primary",
                matched: []
            });
        }
        if (url.pathname.endsWith("/api/imaging.php")) {
            switch (url.searchParams.get("action")) {
                case "features":
                    return makeResponse({
                        shape: { axis_asymmetry: [0.1], circularity: 0.8, area_pixels: 120 },
                        color: { rgb_std: [1, 2, 3] },
                        texture: { glcm_contrast: 0.4 }
                    });
                case "infer_all":
                    return makeResponse({
                        models: { mobile: { available: true, probabilities: { benign: 0.8 } } }
                    });
                case "failed":
                    return makeResponse({ error: "Unavailable" }, 503);
            }
        }
        return makeResponse({}, 500);
    });

    await instance.window.fetch("api/survey.php");
    await instance.window.fetch("api/survey.php?demo=1");
    await instance.window.fetch("api/imaging.php?action=features", { method: "POST" });
    await instance.window.fetch("api/imaging.php?action=infer_all", { method: "POST" });
    await instance.window.fetch("api/imaging.php?action=failed", { method: "POST" });
    await instance.window.fetch("https://other.example/api/survey.php");

    assert.deepEqual(
        JSON.parse(JSON.stringify(instance.activity.getCounts())),
        { surveys: 1, researchScans: 2 }
    );
    assert.equal(instance.elements["activity-surveys"].textContent, "1");
    assert.equal(instance.elements["activity-scans"].textContent, "2");
    assert.match(instance.elements["activity-save-note"].textContent, /Saved in this browser/);

    instance.elements["activity-reset"].dispatch("click");
    assert.deepEqual(
        JSON.parse(JSON.stringify(instance.activity.getCounts())),
        { surveys: 0, researchScans: 0 }
    );
});
