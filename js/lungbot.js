/* Accessible LungBot dialog; only explicitly submitted chat text reaches the server. */
(function () {
    "use strict";
    const messages = [];
    let pending = false;
    let controller = null;
    let generation = 0;
    let previousFocus = null;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined) {
            node.textContent = text;
        }
        return node;
    }

    const launcher = element("button", "lungbot-launcher", "Ask LungBot");
    launcher.type = "button";
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-controls", "lungbot-dialog");
    const dialog = element("dialog", "lungbot-dialog");
    dialog.id = "lungbot-dialog";
    dialog.setAttribute("aria-labelledby", "lungbot-title");
    const header = element("div", "lungbot-header");
    const title = element("h2", "", "LungBot");
    title.id = "lungbot-title";
    const close = element("button", "btn ghost", "Close");
    close.type = "button";
    header.append(title, close);
    const notice = element("p", "lungbot-notice",
        "AI education, not medical advice. Chat text and recent chat history are sent through this server to Anthropic (Claude). Survey answers, photos and location are not attached. Avoid identifying details. Replies can be wrong. For severe breathing trouble, severe chest pain or another emergency, call 911 in the US.");
    notice.id = "lungbot-notice";
    const consentLabel = element("label", "lungbot-consent");
    const consent = element("input");
    consent.type = "checkbox";
    consentLabel.append(consent, document.createTextNode(" I understand and agree to send my chat text to Anthropic."));
    const transcript = element("div", "lungbot-transcript");
    transcript.setAttribute("role", "log");
    transcript.setAttribute("aria-live", "polite");
    transcript.setAttribute("aria-relevant", "additions");
    transcript.setAttribute("aria-label", "Chat messages");
    const form = element("form", "lungbot-form");
    const label = element("label", "", "Your question");
    label.htmlFor = "lungbot-question";
    const input = element("textarea");
    input.id = "lungbot-question";
    input.rows = 3;
    input.maxLength = 1000;
    input.required = true;
    input.setAttribute("aria-describedby", "lungbot-notice lungbot-status");
    const status = element("p", "lungbot-status",
        "Choose Send to contact Claude. Your conversation stays in page memory, not browser storage.");
    status.id = "lungbot-status";
    status.setAttribute("role", "status");
    const actions = element("div", "lungbot-actions");
    const send = element("button", "btn primary", "Send");
    send.type = "submit";
    const clear = element("button", "btn ghost", "Clear chat");
    clear.type = "button";
    actions.append(send, clear);
    form.append(label, input, actions);
    dialog.append(header, notice, consentLabel, transcript, form, status);
    document.body.append(launcher, dialog);

    function updateControls() {
        send.disabled = pending || !consent.checked || input.value.trim() === "";
        input.disabled = pending;
        transcript.setAttribute("aria-busy", String(pending));
    }

    function addMessage(role, content) {
        const message = element("p", "lungbot-message lungbot-" + role);
        message.append(element("strong", "", role === "user" ? "You: " : "LungBot: "));
        message.append(document.createTextNode(content));
        transcript.append(message);
        transcript.scrollTop = transcript.scrollHeight;
    }

    launcher.addEventListener("click", function () {
        previousFocus = document.activeElement;
        if (typeof dialog.showModal !== "function") {
            status.textContent = "This browser does not support the chat dialog. Use a current browser.";
            dialog.setAttribute("open", "");
        } else {
            dialog.showModal();
        }
        consent.focus();
    });

    function closeDialog() {
        if (typeof dialog.close === "function") {
            dialog.close();
        } else {
            dialog.removeAttribute("open");
        }
        if (previousFocus && typeof previousFocus.focus === "function") {
            previousFocus.focus();
        }
    }

    close.addEventListener("click", closeDialog);
    dialog.addEventListener("cancel", function (event) {
        event.preventDefault();
        closeDialog();
    });
    consent.addEventListener("change", function () {
        if (!consent.checked) {
            generation += 1;
            if (controller) {
                controller.abort();
            }
            pending = false;
            status.textContent = "Consent withdrawn. No further messages will be sent. A request already sent may have reached the provider.";
        }
        updateControls();
    });
    input.addEventListener("input", updateControls);
    clear.addEventListener("click", function () {
        generation += 1;
        if (controller) {
            controller.abort();
        }
        messages.length = 0;
        transcript.replaceChildren();
        input.value = "";
        consent.checked = false;
        pending = false;
        status.textContent = "Chat cleared from this page. Clearing cannot delete requests already received by Anthropic or server logs.";
        updateControls();
        consent.focus();
    });
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (pending || !consent.checked) {
            return;
        }
        const question = input.value.trim();
        if (!question) {
            return;
        }
        if (new TextEncoder().encode(question).length > 2000) {
            status.textContent = "Please shorten your question to fewer than 2000 bytes.";
            return;
        }
        const recent = messages.slice(-8);
        const requestMessages = recent.concat([{role: "user", content: question}]);
        pending = true;
        const requestGeneration = generation;
        controller = new AbortController();
        const requestController = controller;
        const timer = setTimeout(function () {
            requestController.abort();
        }, 35000);
        status.textContent = "Waiting for Claude…";
        updateControls();
        try {
            const response = await fetch("api/chat.php", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                cache: "no-store",
                credentials: "same-origin",
                signal: requestController.signal,
                body: JSON.stringify({consent: true, messages: requestMessages})
            });
            const result = await response.json();
            if (requestGeneration !== generation) {
                return;
            }
            if (!response.ok) {
                throw new Error(result.error || "LungBot could not respond.");
            }
            if (typeof result.reply !== "string" || !result.reply.trim()) {
                throw new Error("LungBot returned an empty reply.");
            }
            messages.push({role: "user", content: question});
            messages.push({role: "assistant", content: result.reply});
            if (messages.length > 8) {
                messages.splice(0, messages.length - 8);
            }
            addMessage("user", question);
            addMessage("assistant", result.reply);
            input.value = "";
            status.textContent = "AI reply. Verify health information with a clinician.";
        } catch (error) {
            if (requestGeneration === generation) {
                status.textContent = error.name === "AbortError"
                    ? "The chat request timed out or was stopped. The survey remains available."
                    : error.message;
            }
        } finally {
            clearTimeout(timer);
            if (requestGeneration === generation) {
                pending = false;
                controller = null;
                updateControls();
                if (dialog.open) {
                    input.focus();
                }
            }
        }
    });
    window.addEventListener("pagehide", function () {
        generation += 1;
        if (controller) {
            controller.abort();
        }
    });
    updateControls();
})();
