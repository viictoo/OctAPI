# Change Log

All notable changes to the "OctAPI" extension will be documented in this file.

## [0.1.0] - 2025-02-20
### Added
- **Flask support**: Now detects API routes for Flask, including both decorator-based and class-based routes.

### Fixed
- **Smarter grouping toggle**: The "Group by Basepath" button now only appears when multiple basepaths exist.

## [0.0.3] - 2025-02-19
### Added
- **Copy route feature**: A copy button now appears when hovering over a route.
- **Feedback links**: Added links to a Google Form for reporting bugs and giving feedback.

### Fixed
- **File watching bug**: Route updates were previously triggered by file changes anywhere in the workspace. Now, only changes within the user-specified folder correctly trigger updates.

### Removed
- Unnecessary console logs for a cleaner development experience.

## [0.0.2] - 2025-02-15
### Changed
- Removed extra files to streamline the project.
- Cleaned up heavy, unused dependencies for a lighter extension.

## [0.0.1] - 2025-02-14
### Added
- Initial release of OctAPI.
- Supports Express.js, NestJS, and Koa frameworks.
- Automatic route detection and clickable routes.
