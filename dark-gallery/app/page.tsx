"use client";

import { useState, useCallback } from "react";

const TOTAL = 16;
const images = Array.from({ length: TOTAL }, (_, i) => `/images/img${i + 1}.avif`);

export default function Home() {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const headertext = "Photo Gallery";

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < TOTAL - 1 ? prev + 1 : prev));
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  return (
    <>
      <h1 className="headertext">{headertext}</h1>
      <div className="gallery" id="gallery">
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Photo ${i + 1}`}
            onClick={() => openLightbox(i)}
          />
        ))}
      </div>

      <div
        className={`lightbox${lightboxOpen ? " open" : ""}`}
        id="lightbox"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeLightbox();
        }}
      >
        <a className="close" id="closeBtn" onClick={closeLightbox}>
          &times;
        </a>
        <button id="prev" onClick={goPrev}>&#10094;</button>
        <button id="next" onClick={goNext}>&#10095;</button>
        <img src={images[currentIndex]} alt={`Photo ${currentIndex + 1}`} id="lightbox-img" />
        <div id="thumbnail-strip">
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Thumb ${i + 1}`}
              className={i === currentIndex ? "active" : ""}
              onClick={() => setCurrentIndex(i)}
            />
          ))}
        </div>
      </div>
    </>
  );
}