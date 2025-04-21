'use client';
import { useEffect, useState } from 'react';

export default function Photos() {
  const [groupedPhotos, setGroupedPhotos] = useState(null);

  useEffect(() => {
    async function fetchAndGroupPhotos() {
      try {
        const photosResponse = await fetch('/photos');
        const photosData = await photosResponse.json();

        if (!photosData || !Array.isArray(photosData.Urls)) {
          throw new Error('Invalid response from /photos');
        }

        const groupingResponse = await fetch('/grouping', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrls: photosData.Urls }),
        });

        const groupingData = await groupingResponse.json();
        setGroupedPhotos(groupingData);
      } catch (error) {
        console.error('Error fetching or grouping photos:', error);
      }
    }

    fetchAndGroupPhotos();
  }, []);

  return (
    <div>
      {groupedPhotos ? (
        <>
          <section style={{ marginBottom: '20px' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>Grouped Photos</h1>
            {Object.entries(groupedPhotos.groupedImages).map(([category, urls]) => (
              <div key={category} style={{ marginBottom: '20px' }}>
                <h2 style={{ textTransform: 'capitalize', marginBottom: '10px' }}>{category}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
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
              </div>
            ))}
          </section>

          <section>
            <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>Best Images</h1>
            {Object.entries(groupedPhotos.bestImages).map(([category, urls]) => (
              <div key={category} style={{ marginBottom: '20px' }}>
                <h2 style={{ textTransform: 'capitalize', marginBottom: '10px' }}>{category}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
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
              </div>
            ))}
          </section>
        </>
      ) : (
        <p style={{ textAlign: 'center', fontSize: '18px', color: '#555' }}>Loading...</p>
      )}
    </div>
  );
}