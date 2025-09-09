import { GoogleGenAI, Modality } from "@google/genai";
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

// Per guidelines, API key must be from process.env.API_KEY
// and the client must be initialized with a named parameter.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function App() {
  const [prompt, setPrompt] = useState('');
  // Store an array of base64 image data URLs for the current result
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // State for number of images
  const [numImages, setNumImages] = useState<1 | 3>(1);

  // --- New State for History and Editing Modal ---
  const [historyImages, setHistoryImages] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<{ src: string; index: number } | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  
  // --- State for Save/Load feedback ---
  const [saveMessage, setSaveMessage] = useState('');


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt) {
      setError('Please enter a prompt.');
      return;
    }
    setLoading(true);
    setError('');
    setImages([]);

    try {
      const result = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: numImages,
          outputMimeType: 'image/jpeg',
        },
      });

      const imageDataUrls = result.generatedImages.map(
        (img) => `data:image/jpeg;base64,${img.image.imageBytes}`
      );
      setImages(imageDataUrls);
      // Add new images to the beginning of the history
      setHistoryImages(prevHistory => [...imageDataUrls, ...prevHistory]);

    // FIX: Added curly braces to the catch block to fix syntax and scope issues.
    } catch (e: any) {
      setError(e.message || 'An error occurred while generating the images.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers for Modal and Editing ---
  const handleImageClick = (imgSrc: string, index: number) => {
    setIsModalOpen(true);
    setEditingImage({ src: imgSrc, index });
    setEditPrompt('');
    setEditError('');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingImage(null);
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editPrompt || !editingImage) {
      setEditError('Please enter a description of your desired changes.');
      return;
    }

    setIsEditing(true);
    setEditError('');

    try {
      const base64Data = editingImage.src.split(',')[1];

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
            { text: editPrompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const imagePart = result.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

      if (imagePart && imagePart.inlineData) {
        const newBase64 = imagePart.inlineData.data;
        const newImageSrc = `data:${imagePart.inlineData.mimeType};base64,${newBase64}`;

        const updatedImages = [...images];
        updatedImages[editingImage.index] = newImageSrc;
        setImages(updatedImages);

        setHistoryImages(prevHistory => [newImageSrc, ...prevHistory]);

        handleCloseModal();
      } else {
        throw new Error("The model could not edit the image as requested. Please try a different prompt.");
      }
    } catch (e: any) {
      setEditError(e.message || 'An error occurred while editing the image.');
      console.error(e);
    } finally {
      setIsEditing(false);
    }
  };

  // --- Handlers for Saving and Loading Session ---
  const handleSaveSession = () => {
    try {
      const sessionData = {
        prompt,
        numImages,
        images,
        historyImages,
      };
      localStorage.setItem('ima-gen-session', JSON.stringify(sessionData));
      setSaveMessage('Session saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save session:', error);
      setSaveMessage('Error: Failed to save session.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleLoadSession = () => {
    try {
      const savedSession = localStorage.getItem('ima-gen-session');
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        setPrompt(sessionData.prompt || '');
        setNumImages(sessionData.numImages || 1);
        setImages(sessionData.images || []);
        setHistoryImages(sessionData.historyImages || []);
        setSaveMessage('Session loaded successfully!');
        setError(''); // Clear any previous errors
      } else {
        setSaveMessage('No saved session found.');
      }
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to load session:', error);
      setSaveMessage('Error: Failed to load session.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };


  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1024px', margin: 'auto' }}>
      <h1>IMA-GEN: Image Generation</h1>
      <p>Enter a prompt below to generate an image. Click a generated image to edit it.</p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A robot holding a red skateboard."
          rows={5}
          style={{ width: '100%', padding: '10px', boxSizing: 'border-box', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <label>Number of images to generate:</label>
          <div>
            <input 
              type="radio" 
              id="oneImage" 
              name="numImages" 
              value={1} 
              checked={numImages === 1} 
              onChange={() => setNumImages(1)} 
            />
            <label htmlFor="oneImage" style={{ marginLeft: '5px' }}>One</label>
          </div>
          <div>
            <input 
              type="radio" 
              id="threeImages" 
              name="numImages" 
              value={3} 
              checked={numImages === 3} 
              onChange={() => setNumImages(3)} 
            />
            <label htmlFor="threeImages" style={{ marginLeft: '5px' }}>Three</label>
          </div>
        </div>
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <button type="submit" disabled={loading} style={{ padding: '10px 15px', fontSize: '1rem', cursor: 'pointer' }}>
              {loading ? 'Generating...' : 'Generate Images'}
            </button>
            <button type="button" onClick={handleSaveSession} style={{ padding: '10px 15px', fontSize: '1rem', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>
              Save Session
            </button>
            <button type="button" onClick={handleLoadSession} style={{ padding: '10px 15px', fontSize: '1rem', cursor: 'pointer', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px' }}>
              Load Session
            </button>
        </div>
      </form>
      
      {saveMessage && <p style={{ color: saveMessage.includes('Error') || saveMessage.includes('No saved') ? '#dc3545' : '#28a745', marginTop: '15px' }}>{saveMessage}</p>}
      {error && <p style={{ color: 'red', marginTop: '15px' }}>Error: {error}</p>}
      {loading && <p style={{ marginTop: '20px' }}>Generating your images, please wait...</p>}
      
      {/* Current Results */}
      {images.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Generated Images:</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            {images.map((imgSrc, index) => (
              <img
                key={index}
                src={imgSrc}
                alt={`Generated image ${index + 1}`}
                onClick={() => handleImageClick(imgSrc, index)}
                style={{ width: '100%', height: 'auto', borderRadius: '5px', border: '1px solid #eee', cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Editing Modal */}
      {isModalOpen && editingImage && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button onClick={handleCloseModal} className="modal-close-btn">&times;</button>
            <h3>Edit Image</h3>
            <img src={editingImage.src} alt="Editing preview" style={{ maxWidth: '100%', maxHeight: '40vh', borderRadius: '5px', objectFit: 'contain' }} />
            <form onSubmit={handleEditSubmit} style={{ marginTop: '15px', width: '100%' }}>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="e.g., Change the skateboard to blue."
                rows={3}
                style={{ width: '100%', padding: '10px', boxSizing: 'border-box', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <button type="submit" disabled={isEditing} style={{ marginTop: '10px', padding: '10px 15px', fontSize: '1rem', cursor: 'pointer' }}>
                {isEditing ? 'Editing...' : 'Generate Edit'}
              </button>
            </form>
            {isEditing && <p style={{ marginTop: '10px' }}>Applying your edits...</p>}
            {editError && <p style={{ color: 'red', marginTop: '10px' }}>Error: {editError}</p>}
          </div>
        </div>
      )}

      {/* Image History */}
      {historyImages.length > 0 && (
        <div style={{ marginTop: '40px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
          <h2>Image History</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
            {historyImages.map((imgSrc, index) => (
              <img
                key={`history-${index}`}
                src={imgSrc}
                alt={`History image ${index + 1}`}
                style={{ width: '100%', height: 'auto', borderRadius: '5px', border: '1px solid #eee' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}