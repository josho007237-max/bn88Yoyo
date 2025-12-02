import { createRoot } from "react-dom/client";

function queryText(text) {
  const nodes = Array.from(document.body.querySelectorAll("*"));
  return nodes.find((el) => (el.textContent || "").includes(text)) || null;
}

export function render(ui) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(ui);
  return { container, rerender: (next) => root.render(next) };
}

export const screen = {
  getByText: (text) => {
    const el = queryText(text);
    if (!el) throw new Error(`Text not found: ${text}`);
    return el;
  },
  queryByText: (text) => queryText(text),
  findByText: async (text) => {
    for (let i = 0; i < 20; i++) {
      const el = queryText(text);
      if (el) return el;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`Text not found: ${text}`);
  },
};

export const fireEvent = {
  click: (el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  change: (el, value) => {
    const evt = new Event("input", { bubbles: true });
    el.value = value;
    el.dispatchEvent(evt);
  },
};
