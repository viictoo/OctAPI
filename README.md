<table style="border-collapse: collapse; vertical-align: middle;">
  <tr>
    <td style="border: none;"><img src="https://raw.githubusercontent.com/Hasbi-sabah/OctAPI/master/resources/octapi_logo.png" width="50"></td>
    <td style="border: none; vertical-align: middle;"><h1 style="margin: 0;">OctAPI – API Route Explorer for VS Code</h1></td>
  </tr>
</table>

**Effortlessly visualize and navigate your API routes – directly in VS Code.**

---

## Features

OctAPI provides a seamless way to explore and manage your API routes within Visual Studio Code. Here are its key features:

- **Smart Route Detection** – Scans all files within a user-defined directory to identify API routes.
- **Framework Support** – Works with Express, NestJS, and Koa, with Python frameworks coming soon.
- **Jump to Code** – Clicking a route takes you directly to the exact line where it's defined.
- **Flexible Organization** – Toggle between grouping by basepath or HTTP method.
- **Native Sidebar Integration** – View all detected routes directly in VS Code’s sidebar.

### Demo

![OctAPI Demo](https://raw.githubusercontent.com/Hasbi-sabah/OctAPI/master/resources/octapi_demo.gif)

---

## Requirements

- **Visual Studio Code**: Ensure you have VS Code installed.
- **Supported Frameworks**: Currently supports Express.js, NestJS, and Koa. Python frameworks (Flask, FastAPI, Django) are coming soon.

---

## Extension Settings

This extension contributes the following settings:

- `octapi.path`: Define custom search paths for route detection.
- `octapi.framework`: Set the framework for route detection.

---

## Installation

1. Download the latest `.vsix` package from the [Releases](https://github.com/Hasbi-sabah/OctAPI/releases) page.
2. Open VS Code and navigate to **Extensions** (`Ctrl+Shift+X`).
3. Click the `...` menu and select **Install from VSIX...**.
4. Select the downloaded file and install it.
5. Reload VS Code if needed.

---

## Known Issues

- Python framework support is still in progress.
- Large codebases may experience slower scanning times.

---

## Release Notes

### 0.0.1

- Initial release of OctAPI.
- Supports Express.js, NestJS, and Koa frameworks.
- Automatic route detection and clickable routes.

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