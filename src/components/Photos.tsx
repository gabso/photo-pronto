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
        <pre>{JSON.stringify(groupedPhotos, null, 2)}</pre>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}