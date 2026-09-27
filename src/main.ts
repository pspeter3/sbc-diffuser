import "./style.scss";
import heroImg from "./assets/hero.png";
import typescriptLogo from "./assets/typescript.svg";
import viteLogo from "./assets/vite.svg";
import { setupCounter } from "./counter.ts";

document.querySelector<HTMLElement>("#app")!.innerHTML = `
  <header class="intro">
    <div class="hero" aria-hidden="true">
      <img src="${heroImg}" class="base" width="170" height="179" alt="" />
      <img src="${typescriptLogo}" class="framework" alt="" />
      <img src="${viteLogo}" class="vite" alt="" />
    </div>
    <h1>Get started</h1>
    <p>Edit <code>src/main.ts</code> and save to test HMR.</p>
    <button id="counter" type="button"></button>
  </header>

  <section class="grid" aria-label="Next steps">
    <article>
      <h2>Documentation</h2>
      <p>Your questions, answered.</p>
      <div class="resource-links">
        <a href="https://vite.dev/" role="button" class="outline" target="_blank" rel="noopener noreferrer">Explore Vite</a>
        <a href="https://www.typescriptlang.org/" role="button" class="outline" target="_blank" rel="noopener noreferrer">Learn TypeScript</a>
      </div>
    </article>
    <article>
      <h2>Connect with us</h2>
      <p>Join the Vite community.</p>
      <div class="resource-links">
        <a href="https://github.com/vitejs/vite" role="button" class="outline" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://chat.vite.dev/" role="button" class="outline" target="_blank" rel="noopener noreferrer">Discord</a>
        <a href="https://x.com/vite_js" role="button" class="outline" target="_blank" rel="noopener noreferrer">X.com</a>
        <a href="https://bsky.app/profile/vite.dev" role="button" class="outline" target="_blank" rel="noopener noreferrer">Bluesky</a>
      </div>
    </article>
  </section>
`;

setupCounter(document.querySelector<HTMLButtonElement>("#counter")!);
