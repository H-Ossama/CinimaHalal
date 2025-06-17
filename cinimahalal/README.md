# CinimaHalal Project

## Overview
CinimaHalal is a modern movie and series streaming application built with Next.js and React. It provides a user-friendly interface for streaming content while offering advanced filtering options to enhance the viewing experience.

## Features
- **User Authentication**: Sign up and log in using Firebase Auth.
- **Movie Streaming**: Stream movies with support for subtitles and filtering options.
- **Automatic Subtitle Fetching**: Automatically download and load Arabic subtitles from OpenSubtitles or Subscene.
- **Scene Filtering Engine**: Skip, mute, or blur inappropriate content based on user-defined filters.
- **Movie and Series Metadata**: Fetch detailed information about movies and series from TMDB.
- **User Ratings and Comments**: Users can rate movies and leave comments.
- **Responsive Design**: Built with Tailwind CSS for a modern and responsive UI.

## Project Structure
```
cinimahalal
├── src
│   ├── app
│   ├── components
│   ├── lib
│   ├── hooks
│   └── services
├── public
│   └── assets
├── .env.local
├── package.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Getting Started
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd clean-stream
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root directory and add your Firebase and TMDB API keys.

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to `http://localhost:3000` to view the application.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.