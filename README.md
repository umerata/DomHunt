# DOM Hunt

**DOM Hunt** is a lightweight, fast, and powerful VS Code extension designed to help developers query HTML structures across local files using CSS selectors.

Tired of manually searching through dozens of files to find where a specific component or DOM structure lives? **DOM Hunt** lets you perform CSS-selector-based searches across your entire workspace, just like you would in a browser console.

## Features

*   **Fast Workspace Search:** Search for DOM elements across your entire project.
*   **CSS Selector Support:** Use standard CSS selectors (e.g., `.page-header > vc-textbox`) to find your components.
*   **Dual Search (AND logic):** Find files that contain *both* specific components simultaneously.
*   **Configurable:** Easily define which folders to include or exclude (e.g., ignore `node_modules` or `dist`).
*   **Persistent History:** Remembers your previous searches for quick re-use.
*   **Native Navigation:** Results are displayed in the Output panel—just click a link to jump directly to the code.

## Commands

You can access these commands via the **Command Palette** (`Ctrl+Shift+P` or `Cmd+Shift+P`):

1.  **`DOM Hunt: Single Selector`**
    *   Find all occurrences of a specific element or structure. Results provide the file path and line number for every match.
2.  **`DOM Hunt: Dual Selector (AND)`**
    *   Find all files that contain *both* Selector A and Selector B. Great for auditing files that contain specific component combinations.

## Configuration

You can customize how **DOM Hunt** behaves via VS Code Settings:

1.  Open **Settings** (`Ctrl+,` or `Cmd+,`).
2.  Search for **`domHunt`**.
3.  **Include Folders:** Modify the glob patterns to specify which files/directories to search (default: `**/*.html`).
4.  **Exclude Folders:** Modify the glob patterns to ignore directories (default: `**/node_modules/**`, `**/dist/**`).

## Usage Tips

*   When the results appear in the **DOM Search Results** output channel, simply **click the file path** to open that file at the specific line where the match was found.
*   Use the `Single Selector` command to quickly locate elements; use the `Dual Selector` command to audit your codebase for specific architectural patterns.

***