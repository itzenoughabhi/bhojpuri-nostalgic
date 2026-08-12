import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ListMusic,
  LoaderCircle,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import {
  extractPlaylistId,
  getPlaylistEmbedUrl,
  getPlaylistTrackNames,
  loadYouTubeIframeApi,
} from "../utils/youtubeMusic";
import "./MusicPlayer.css";

const PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

function formatTime(time) {
  if (!Number.isFinite(time) || time < 0) {
    return "0:00";
  }

  const minutes = Math.floor(time / 60);
  const seconds = String(Math.floor(time % 60)).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function MusicPlayer({ playlistUrl }) {
  const playerHostRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackTitle, setTrackTitle] = useState("Loading playlist");
  const [artistName, setArtistName] = useState("YouTube Music");
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [queueStatus, setQueueStatus] = useState("loading");
  const [queueMessage, setQueueMessage] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState("");
  const [notice, setNotice] = useState("");

  const playlistId = extractPlaylistId(playlistUrl);
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  const fallbackUrl = playlistId ? getPlaylistEmbedUrl(playlistId) : null;
  const progress = duration ? Math.min((currentTime / duration) * 100, 100) : 0;
  const hasCustomControls = status === "ready";

  useEffect(() => {
    if (!playlistId) {
      setStatus("error");
      setNotice("The playlist URL is missing a YouTube playlist ID.");
      return undefined;
    }

    let isActive = true;
    let player;
    const fallbackTimer = window.setTimeout(() => {
      if (isActive && !playerRef.current) {
        setStatus("fallback");
        setNotice("Opening the official YouTube playlist player instead.");
      }
    }, 10000);

    setStatus("loading");
    setNotice("");
    setTrackTitle("Loading playlist");
    setArtistName("YouTube Music");

    function syncPlayerData(target) {
      if (!isActive) {
        return;
      }

      const videoData = target.getVideoData?.();
      const nextDuration = target.getDuration?.() || 0;

      setCurrentTime(target.getCurrentTime?.() || 0);
      setDuration(nextDuration);
      setTrackTitle(videoData?.title || "YouTube Music playlist");
      setArtistName(videoData?.author || "YouTube Music");
      setCurrentVideoId(videoData?.video_id || "");
    }

    async function createPlayer() {
      try {
        await loadYouTubeIframeApi();
        if (!isActive || !playerHostRef.current) {
          return;
        }

        player = new window.YT.Player(playerHostRef.current, {
          width: "200",
          height: "200",
          playerVars: {
            autoplay: 0,
            controls: 0,
            list: playlistId,
            listType: "playlist",
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (!isActive) {
                return;
              }

              window.clearTimeout(fallbackTimer);
              playerRef.current = event.target;
              try {
                event.target.cuePlaylist({
                  list: playlistId,
                  listType: "playlist",
                });
              } catch {
                setStatus("fallback");
                setNotice("Opening the official YouTube playlist player instead.");
                return;
              }
              syncPlayerData(event.target);
              setStatus("ready");
            },
            onStateChange: (event) => {
              if (!isActive) {
                return;
              }

              const nextState = event.data;
              setIsPlaying(nextState === PLAYER_STATE.PLAYING);
              setIsBuffering(nextState === PLAYER_STATE.BUFFERING);
              if (nextState === PLAYER_STATE.ENDED) {
                setCurrentTime(event.target.getDuration?.() || 0);
              }
              if (nextState === PLAYER_STATE.PLAYING || nextState === PLAYER_STATE.CUED) {
                syncPlayerData(event.target);
              }
            },
            onAutoplayBlocked: () => {
              if (isActive) {
                setNotice("Press play to start music in this browser.");
              }
            },
            onError: (event) => {
              if (isActive) {
                setStatus("fallback");
                setNotice(
                  `YouTube could not play this playlist (error ${event.data}).`,
                );
              }
            },
            onVideoDataChange: (event) => syncPlayerData(event.target),
          },
        });
      } catch {
        if (isActive) {
          setStatus("fallback");
          setNotice("Opening the official YouTube playlist player instead.");
        }
      }
    }

    createPlayer();

    return () => {
      isActive = false;
      window.clearTimeout(fallbackTimer);
      playerRef.current = null;
      player?.destroy?.();
    };
  }, [playlistId]);

  useEffect(() => {
    if (!playlistId || !apiKey) {
      setQueueStatus("error");
      setQueueMessage("Add VITE_YOUTUBE_API_KEY to display the song list.");
      return undefined;
    }

    const controller = new AbortController();
    setQueueStatus("loading");
    setQueueMessage("");

    getPlaylistTrackNames(playlistId, apiKey, controller.signal)
      .then((playlistTracks) => {
        setTracks(playlistTracks);
        setQueueStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setQueueStatus("error");
          setQueueMessage(error.message);
        }
      });

    return () => controller.abort();
  }, [apiKey, playlistId]);

  useEffect(() => {
    if (!hasCustomControls) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime?.() || 0);
        setDuration(playerRef.current.getDuration?.() || 0);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [hasCustomControls]);

  function togglePlayback() {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    setNotice("");
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }

  function seekTo(event) {
    const nextTime = Number(event.target.value);
    setCurrentTime(nextTime);
    playerRef.current?.seekTo(nextTime, true);
  }

  function playTrack(position) {
    if (Number.isInteger(position)) {
      playerRef.current?.playVideoAt(position);
    }
  }

  const controlProps = { disabled: !hasCustomControls, type: "button" };

  return (
    <section className="music-player" aria-label="Playlist player">
      <div className="youtube-player-host" ref={playerHostRef} aria-hidden="true" />

      {isPlaylistOpen && fallbackUrl && (
        <aside className="playlist-queue" aria-labelledby="playlist-queue-title">
          <header className="playlist-queue-header">
            <div>
              <p id="playlist-queue-title">Playlist</p>
              <span>{tracks.length ? `${tracks.length} songs` : "Song list"}</span>
            </div>
            <button
              className="queue-close-button"
              type="button"
              title="Close playlist"
              aria-label="Close playlist"
              onClick={() => setIsPlaylistOpen(false)}
            >
              <X aria-hidden="true" size={17} />
            </button>
          </header>
          {queueStatus === "loading" && (
            <div className="queue-state" role="status">
              <LoaderCircle className="spin" aria-hidden="true" size={15} />
              <span>Loading songs</span>
            </div>
          )}
          {queueStatus === "error" && (
            <div className="queue-state queue-state-error" role="alert">
              <AlertCircle aria-hidden="true" size={15} />
              <span>{queueMessage}</span>
            </div>
          )}
          {queueStatus === "ready" && (
            <ol className="song-name-list">
              {tracks.map((track) => (
                <li key={track.id}>
                  <button
                    className={track.videoId === currentVideoId ? "is-current" : ""}
                    type="button"
                    disabled={!hasCustomControls || !track.videoId}
                    onClick={() => playTrack(track.position)}
                  >
                    <span>{track.position + 1}</span>
                    <strong>{track.title}</strong>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      )}

      {status === "fallback" && fallbackUrl ? (
        <div className="music-player-fallback">
          <div className="player-status player-status-error">
            <AlertCircle aria-hidden="true" size={17} />
            <span>{notice}</span>
          </div>
          <iframe
            className="youtube-fallback-frame"
            src={fallbackUrl}
            title="YouTube playlist player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <>
          <div className="music-artwork" aria-hidden="true">
            <span className="artwork-title">Bihari</span>
          </div>

          <div className="music-player-main">
            <div className="track-meta">
              <div className="track-title-row">
                <p className="track-title">{trackTitle}</p>
                <span
                  className={`playing-bars${isPlaying ? " is-playing" : ""}`}
                  aria-label={isPlaying ? "Now playing" : "Paused"}
                >
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <p className="playlist-name">{artistName}</p>
            </div>

            <div className="player-progress">
              <label className="sr-only" htmlFor="music-progress">
                Playback position
              </label>
              <input
                id="music-progress"
                className="progress-slider"
                type="range"
                min="0"
                max={Math.max(duration, 1)}
                value={Math.min(currentTime, Math.max(duration, 1))}
                onChange={seekTo}
                style={{ "--progress": `${progress}%` }}
                disabled={!hasCustomControls}
              />
              <div className="time-row">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          <div className="music-actions">
            <button
              {...controlProps}
              className="icon-button"
              title="Previous track"
              aria-label="Previous track"
              onClick={() => playerRef.current?.previousVideo()}
            >
              <SkipBack aria-hidden="true" size={17} />
            </button>
            <button
              {...controlProps}
              className="play-button"
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
              aria-pressed={isPlaying}
              onClick={togglePlayback}
            >
              {isBuffering ? (
                <LoaderCircle className="spin" aria-hidden="true" size={19} />
              ) : isPlaying ? (
                <Pause aria-hidden="true" size={19} fill="currentColor" />
              ) : (
                <Play aria-hidden="true" size={19} fill="currentColor" />
              )}
            </button>
            <button
              {...controlProps}
              className="icon-button"
              title="Next track"
              aria-label="Next track"
              onClick={() => playerRef.current?.nextVideo()}
            >
              <SkipForward aria-hidden="true" size={17} />
            </button>
            <button
              className="icon-button playlist-toggle"
              type="button"
              title={isPlaylistOpen ? "Hide playlist" : "Show playlist"}
              aria-label={isPlaylistOpen ? "Hide playlist" : "Show playlist"}
              aria-pressed={isPlaylistOpen}
              onClick={() => setIsPlaylistOpen((isOpen) => !isOpen)}
            >
              <ListMusic aria-hidden="true" size={17} />
            </button>
          </div>
        </>
      )}

      {status === "loading" && (
        <div className="player-status player-status-loading" role="status">
          <LoaderCircle className="spin" aria-hidden="true" size={16} />
          <span>Connecting to YouTube Music</span>
        </div>
      )}

      {status === "error" && (
        <div className="player-status player-status-error" role="alert">
          <AlertCircle aria-hidden="true" size={17} />
          <span>{notice}</span>
        </div>
      )}
    </section>
  );
}

export default MusicPlayer;
