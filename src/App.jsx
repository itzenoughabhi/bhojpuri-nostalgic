import { useEffect, useState } from "react";
import hero from "./assets/hero.png";
import heroMobile from "./assets/heromobile.png";
import MusicPlayer from "./components/MusicPlayer";
import "./App.css";

// Replace this URL with a public or unlisted YouTube Music playlist you own.
const MUSIC_PLAYLIST_URL =
  "https://music.youtube.com/playlist?list=PLWE7nWEf0Wko&si=ZGteKbPhJxMneE0w";

const indiaDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/kolkata",
});

function App() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="hero">
      
      <picture>
        <source media="(max-width: 767px)" srcSet={heroMobile} />
        <img
          className="hero-image"
          src={hero}
          alt="Bihar riverside scene with the Hindi title Bihari"
        />
      </picture>

      <p className="content-notice">Non-vulgar songs only</p>
      <time className="date-time" dateTime={now.toISOString()}>
        {indiaDateTimeFormatter.format(now)}
      </time>
      <MusicPlayer playlistUrl={MUSIC_PLAYLIST_URL} />
      <a
        className="instagram-link"
        href="https://www.instagram.com/fit.abhi_0/"
        target="_blank"
        rel="noreferrer"
        aria-label="Visit fit.abhi_0 on Instagram"
        title="Instagram: fit.abhi_0"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle className="instagram-dot" cx="17.4" cy="6.8" r="1" />
        </svg>
      </a>
    </main>
  );
}

export default App;
