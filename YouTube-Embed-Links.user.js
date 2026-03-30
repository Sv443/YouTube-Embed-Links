// ==UserScript==
// @name        YouTube Embed Links
// @description Adds a link to each YouTube embed, in case the "Sign in to confirm you're not a bot" message pops up
// @namespace   https://github.com/Sv443
// @match       https://*/*
// @grant       none
// @version     0.1.0
// @author      Sv443
// @license     MIT
// @run-at      document-start
// @require     https://update.greasyfork.org/scripts/472956/1772359/UserUtils.js
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
  /^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]+)/,
];

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
});

/**
 * Gets called with each found iframe element.
 * Checks if the src is a valid YT embed URL, then extracts the ID and adds an element externally linking to the video.
 */
function handleIframe(el) {
  console.log(consolePrefix, ">>1");
  if(el.classList.contains(checkedClassName))
    return;

  el.classList.add("checked-embed-link", checkedClassName);

  if(typeof el.src !== "string" || el.src.length === 0)
    return;

  if(srcPatterns.some(re => re.test(el.src))) {
    const vidId = getVideoIdFromIframeSrc(el.src);
    if(!vidId)
      return console.warn(consolePrefix, "Couldn't extract video ID from iframe:", el);

    addExtVideoLinkToIframe(el, vidId);
  }
}

/** Extracts the video ID from the iframe src URL. Simple heuristic that checks for last pathname segment, then the ?q search param. */
function getVideoIdFromIframeSrc(src) {
  const url = new URL(src);

  const pathnameId = url.pathname.split("/").at(-1)?.trim();
  if(typeof pathnameId === "string" && isValidVideoId(pathnameId))
    return pathnameId;

  const paramId = url.searchParams?.q?.trim();
  if(typeof paramId === "string" && isValidVideoId(paramId))
    return paramId;
}

/** Adds an anchor element after the iframe to externally link to the video page. */
function addExtVideoLinkToIframe(ifrEl, vidId) {
  const linkContEl = document.createElement("span");
  linkContEl.classList.add("ytel-iframe-link-container");

  const linkEl = document.createElement("a");
  linkEl.classList.add("ytel-iframe-link");
  linkEl.href = `https://www.youtube.com/watch?v=${vidId}`;
  linkEl.target = "_blank";
  linkEl.rel = "noopener noreferrer";
  linkEl.textContent = "Open in new tab";
  linkEl.title = linkEl.ariaLabel = "Click to open the video in a new tab.";

  const removeEl = document.createElement("a");
  removeEl.classList.add("ytel-remove-iframe-link");
  removeEl.href = "#";
  removeEl.textContent = "[×]";
  removeEl.title = removeEl.ariaLabel = "Click to remove this link.";
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

/** Checks if the given string is a valid YT video ID. */
function isValidVideoId(id) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
