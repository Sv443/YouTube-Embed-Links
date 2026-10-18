// ==UserScript==
// @name        YouTube Embed Links
// @version     1.0.1
// @namespace   https://github.com/Sv443
// @description Adds a link to each YouTube embed iframe, in case the "Sign in to confirm you're not a bot" message pops up.
// @license     MIT
// @author      Sv443
// @source      https://github.com/Sv443/YouTube-Embed-Links
// @homepage    https://github.com/Sv443/YouTube-Embed-Links
// @homepageURL https://github.com/Sv443/YouTube-Embed-Links
// @supportURL  https://github.com/Sv443/YouTube-Embed-Links/issues
// @updateURL   https://github.com/Sv443/YouTube-Embed-Links/raw/refs/heads/main/YouTube-Embed-Links.user.js
// @match       https://*/*
// @grant       none
// @run-at      document-start
// @require     https://cdn.jsdelivr.net/npm/@sv443-network/userutils@11.0.0/dist/UserUtils.user.js
// ==/UserScript==

/**
 * Amount of milliseconds to debounce DOM modification listeners.
 * Lower means the script reacts faster to changes, but also impacts the CPU more.
 * Set this number higher if you experience performance issues when this script is enabled.
 */
const debounceTime = 300;

/** CSS style that is applied globally. */
const globalStyle = `\
.ytel-iframe-link-container {
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 9999999999;
  display: flex;
  flex-direction: row;
  gap: 8px;
}

.ytel-remove-iframe-link {
  color: #e8203f;
}
`;

/** Prefix to discern logs from different sources and to make filtering easier. */
const consolePrefix = "[YT Embed Links]";

/** Class that gets added to each iframe that was checked. */
const checkedClassName = `checked-embed-link-${UserUtils.randomId(8, 36)}`;

/** Patterns that indicate whether an iframe's src is a valid YT embed URL. */
const srcPatterns = [
  /^https?:\/\/(?:(?:www|m)\.)?youtu(?:\.?be|be(?:-nocookie)?\.com)\/embed\/([a-zA-Z0-9_-]+)/,
];

/** Keys of extra URL parameters to also transfer to the link besides just `?v`. */
const extraParams = [
  "t", "start", "time_continue", "list", "listType",
  "index", "start_radio", "lc", "ab_channel", "hl",
  "gl", "app", "sub_confirmation",
];

/** Keys of parameters that should be renamed if present. The keys also have to be present in {@linkcode extraParams}. */
const renameParams = {
  "start": "t",
};

/** Script entrypoint. */
document.addEventListener("DOMContentLoaded", () => {
  const obs = new UserUtils.SelectorObserver(document.body, {
    defaultDebounce: debounceTime,
  });

  obs.addListener("iframe", {
    all: true,
    continuous: true,
    listener(iframes) {
      for(const ifrEl of iframes)
        handleIframe(ifrEl);
    },
  });

  UserUtils.addGlobalStyle(globalStyle).classList.add("ytel-style");

  console.log(consolePrefix, "Successfully initialized.");
});

/**
 * Gets called with each found iframe element.
 * Checks if the src is a valid YT embed URL, then extracts the ID and adds an element externally linking to the video.
 * @param {HTMLElement} el The `<iframe>` to check
 * @return {void}
 */
function handleIframe(el) {
  if(el.classList.contains(checkedClassName))
    return;

  el.classList.add("checked-embed-link", checkedClassName);

  if(typeof el.src !== "string" || el.src.length === 0)
    return;

  if(srcPatterns.some(re => re.test(el.src))) {
    const vidId = getVideoIdFromIframeSrc(el.src);
    if(!vidId)
      return console.warn(consolePrefix, "Couldn't extract video ID from iframe:", el);

    const extraParams = getExtraParamsFromIframeSrc(el.src);

    addExtVideoLinkToIframe(el, vidId, extraParams);
  }
}

/**
 * Extracts the video ID from the iframe src URL. Simple heuristic that checks for last pathname segment, then the ?v search param.
 * @param {string} src The `src` prop of the `<iframe>`
 * @return {string}
 */
function getVideoIdFromIframeSrc(src) {
  const url = new URL(src);

  const paramId = url.searchParams?.v?.trim();
  if(typeof paramId === "string" && isValidVideoId(paramId))
    return paramId;

  const pathnameId = url.pathname.split("/").at(-1)?.trim();
  if(typeof pathnameId === "string" && isValidVideoId(pathnameId))
    return pathnameId;
}

/**
 * Creates a URL parameter string from any parameters in the given `src` whose keys are in {@linkcode extraParams}
 * @param {string} src The `src` prop of the `<iframe>`
 * @return {string}
 */
function getExtraParamsFromIframeSrc(src) {
  const { searchParams, pathname } = new URL(src);
  return extraParams.reduce((a, key) => {
    const val = searchParams.get(key);
    if(!val)
      return a;

    return `${a}&${renameParams?.[key] ?? key}=${val}`;
  }, "");
}

/**
 * Adds an anchor element after the iframe to externally link to the video page.
 * @param {HTMLElement} ifrEl The `<iframe>` to modify
 * @param {string} vidId ID of the video playing in the `<iframe>`
 * @param {string} [extraParams] Optional string of extra parameters to include in the link - format: `&p1=v1&p2=v2...`
 * @returns {void}
 */
function addExtVideoLinkToIframe(ifrEl, vidId, extraParams) {
  const linkContEl = document.createElement("span");
  linkContEl.classList.add("ytel-iframe-link-container");

  const linkEl = document.createElement("a");
  linkEl.classList.add("ytel-iframe-link");
  linkEl.href = `https://www.youtube.com/watch?v=${vidId}${extraParams??""}`;
  linkEl.target = "_blank";
  linkEl.rel = "noopener noreferrer";
  linkEl.textContent = "Open in new tab";
  linkEl.title = linkEl.ariaLabel = "Click to open the video in a new tab.";

  const removeEl = document.createElement("a");
  removeEl.classList.add("ytel-remove-iframe-link");
  removeEl.href = "#";
  removeEl.textContent = "[×]";
  removeEl.title = removeEl.ariaLabel = "Click to dismiss this link. Reload the tab to bring it back.";
  removeEl.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();

    linkContEl.remove();
  });

  linkContEl.appendChild(linkEl);
  linkContEl.appendChild(removeEl);

  ifrEl.parentNode.appendChild(linkContEl);

  console.log(consolePrefix, "Successfully added link element to iframe:", ifrEl);
}

/**
 * Checks if the given string is a valid YT video ID.
 * @param {string} id Video ID
 */
function isValidVideoId(id) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
