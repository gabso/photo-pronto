'use client';
import { useEffect, useState } from 'react';
import { MediaItem } from "../app/Interfaces/MediaItem";

export default function Photos() {
  const [groupedPhotos, setGroupedPhotos] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchAndGroupPhotos(fetchFromGoogle) {
    try {
      setLoading(true);
      let photosData;

      if (fetchFromGoogle) {
        const photosResponse = await fetch('/photos');
        photosData = await photosResponse.json();

        if (!photosData || !Array.isArray(photosData.mediaItems)) {
          throw new Error('Invalid response from /photos');
        }
      } else {
        const existingResponse = await fetch('/grouping', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mediaItems: [] }), // Empty mediaItems to load existing categorized photos
        });

        const existingData = await existingResponse.json();
        setGroupedPhotos(existingData);
        setLoading(false);
        return;
      }

      const groupingResponse = await fetch('/grouping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mediaItems: photosData.mediaItems }),
      });

      const groupingData = await groupingResponse.json();
      setGroupedPhotos(groupingData);
    } catch (error) {
      console.error('Error fetching or grouping photos:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!groupedPhotos && !loading ? (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => fetchAndGroupPhotos(true)}
            style={{
              padding: '10px 20px',
              margin: '10px',
              fontSize: '16px',
              cursor: 'pointer',
              borderRadius: '5px',
              backgroundColor: '#007BFF',
              color: '#fff',
              border: 'none',
            }}
          >
            Fetch All Photos from Google Photos
          </button>
          <button
            onClick={() => fetchAndGroupPhotos(false)}
            style={{
              padding: '10px 20px',
              margin: '10px',
              fontSize: '16px',
              cursor: 'pointer',
              borderRadius: '5px',
              backgroundColor: '#28A745',
              color: '#fff',
              border: 'none',
            }}
          >
            Load Existing Categorized Photos
          </button>
        </div>
      ) : loading ? (
        <p style={{ textAlign: 'center', fontSize: '18px', color: '#555' }}>Loading...</p>
      ) : (
        <>
          <section style={{ marginBottom: '20px' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>Photos by Category</h1>
            {Object.entries(groupedPhotos.groupedImages).map(([category, urls]) => (
              <div key={category} style={{ marginBottom: '20px' }}>
                <h2 style={{ textTransform: 'capitalize', marginBottom: '10px', textAlign:'center' }}>{category}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '10px' }}>
                  {urls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={category}
                      style={{
                        width: '150px',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                  ))}
                </div>
                {groupedPhotos.bestImages[category] && urls.length > 1 && (
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <h3 style={{ marginBottom: '10px' }}>Best Image</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '10px' }}>

                    {groupedPhotos.bestImages[category].map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`${category} best`}
                        style={{
                          width: '200px',
                          height: '200px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
                        }}
                      />
                    ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}