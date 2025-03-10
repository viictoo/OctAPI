![OctAPI Banner](https://raw.githubusercontent.com/Hasbi-sabah/OctAPI/master/resources/banner.png)

<table style="border-collapse: collapse; vertical-align: middle;">
  <tr>
    <td style="border: none;"><img src="https://raw.githubusercontent.com/Hasbi-sabah/OctAPI/master/resources/octapi_logo.png" width="50"></td>
    <td style="border: none; vertical-align: middle;"><h1 style="margin: 0;">OctAPI – API Route Explorer for VS Code</h1></td>
  </tr>
</table>

**Effortlessly visualize and navigate your API routes – directly in VS Code.**

---

### Demo

![OctAPI Demo](https://raw.githubusercontent.com/Hasbi-sabah/OctAPI/master/resources/octapi_demo.gif)

---

## Features

OctAPI provides a seamless way to explore and manage your API routes within Visual Studio Code. Here are its key features:

- **Smart Route Detection** – Scans all files within a user-defined directory to identify API routes.
- **Framework Support** – Works with Express, NestJS, Koa, Flask, and FastAPI.
- **Jump to Code** – Clicking a route takes you directly to the exact line where it's defined.
- **Quick Copy with Prefixing** – Hover over a route to reveal a copy button, with an option to specify a route prefix.
- **Flexible Organization** – Toggle between grouping by basepath or HTTP method.
- **Visual Enhancements** – Routes include distinct icons and colors, including special styling for `PATCH` routes.
- **Native Sidebar Integration** – View all detected routes directly in VS Code’s sidebar.
- **Favorite Routes Management** – Star and persistently favorite frequently used routes, with an option to clear all favorites via a dedicated command.
- **Postman Export Command** – Export API routes as an importable Postman JSON collection, complete with method, full path, and path parameters, organized in appropriate subfolders.

---

## 🛠 Report Issues & Give Feedback

Have a suggestion or found a bug? Let us know!  
👉 [Submit feedback here](https://forms.gle/4BuPRUAzjA2JBpjd8)

---

## Requirements

- **Visual Studio Code**: Ensure you have VS Code installed.
- **Supported Frameworks**: Express.js, NestJS, Koa, Flask, and FastAPI.

---

## Extension Settings

This extension contributes the following settings:

- `octapi.path`: Define custom search paths for route detection.
- `octapi.framework`: Set the framework for route detection.
- `octapi.urlPrefix`: Specify a prefix to prepend when copying routes.

---

## Installation

You can install OctAPI from the following sources:

### Microsoft Marketplace

1. Visit the [OctAPI extension page on the Microsoft Marketplace](https://marketplace.visualstudio.com/items?itemName=HasbiSabah.octapi).
2. Click the **Install** button.
3. Follow the prompts to install the extension in VS Code.

### Open VSX

1. Visit the [OctAPI extension page on Open VSX](https://open-vsx.org/extension/Hasbi-Sabah/octapi).
2. Click the **Install** button.
3. Follow the prompts to install the extension.

### Manual Installation

1. Download the latest `.vsix` package from the [Releases](https://github.com/Hasbi-sabah/OctAPI/releases) page.
2. Open VS Code and navigate to **Extensions** (`Ctrl+Shift+X`).
3. Click the `...` menu and select **Install from VSIX...**.
4. Select the downloaded file and install it.
5. Reload VS Code if needed.

---

## Known Issues

- More language support is still in progress.
- Large codebases may experience slower scanning times.

---

## Release Notes

### v0.4.1 - 2025-03-10 
- **Postman Export Grouping**: Routes are now grouped into subfolders based on their basepath instead of all being placed in the root folder, making API organization clearer.

### v0.4.0 - 2025-03-05
- **Enhanced FastAPI Processing**: Improved FastAPI route processing to handle router prefixes and include them in the basepath.
- **Postman Export Command**: Added a command that exports API routes as an importable Postman JSON collection, including method, full path, and path parameters.
- **Koa Route Extraction**: Fixed Koa route extraction by enhancing method detection and prefix handling to avoid mistaking database calls for routes.
- **Copy Button Bug**: Fixed an issue where the copy button would disappear after being clicked.

### v0.3.0 - 2025-03-04
- **Favorite Routes Management**: Added support for starring routes with persistence and toggle functionality, and introduced a command to clear favorite routes with updated UI and improved layout.
- **Refactored Command Handling**: Removed unused commands for opening routes and copying route paths.

### v0.2.0 - 2025-02-25
- **FastAPI Support**: Now detects API routes for FastAPI, making OctAPI more versatile for Python developers.
- **Custom Route Prefixing**: Users can now specify a route prefix when copying routes.
- **Distinct Icon and Color for PATCH Routes**: PATCH routes now have unique color and icon for better visual distinction.

### v0.1.0 - 2025-02-20
- **Flask Support**: Now detects API routes for Flask, including both decorator-based and class-based routes.
- **Smarter Grouping Toggle**: The "Group by Basepath" button now only appears when multiple basepaths exist.

### v0.0.3 - 2025-02-19
- **Copy Route Feature**: A copy button now appears when hovering over a route.
- **Feedback Links**: Added links to a Google Form for reporting bugs and giving feedback.
- **File Watching Bug Fix**: Route updates were previously triggered by file changes anywhere in the workspace; now only changes within the user-specified folder trigger updates.
- **Console Logs Removed**: Removed unnecessary console logs for a cleaner development experience.

### v0.0.2 - 2025-02-15
- **Project Streamlining**: Removed extra files and cleaned up heavy, unused dependencies for a lighter extension.

### v0.0.1 - 2025-02-14
- **Initial Release**: Supports Express.js, NestJS, and Koa frameworks with automatic route detection and clickable routes.

---

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repo.
2. Create a **feature branch** (`git checkout -b feature-name`).
3. Commit changes (`git commit -m "Describe feature"`).
4. Push to your branch (`git push origin feature-name`).
5. Open a **Pull Request**.

---

## License

Licensed under the **Apache 2.0 License**. See [LICENSE](LICENSE) for details.

---

## Contact

- **Author**: Hasbi Sabah
- **Email**: sabahhasbi00@gmail.com
- **GitHub**: [Hasbi-sabah](https://github.com/Hasbi-sabah)

---

**🚀 OctAPI – Stop searching, start coding.**
