import React, { useState, useEffect, useRef } from 'react';
import { useRive } from "@rive-app/react-canvas";
import { 
  Mic, 
  MicOff,
  Send,
  Volume2,
  Brain,
  Sparkles,
  Star,
  AlertCircle,
  Settings
} from 'lucide-react';

const MAKIA_ORACLE = () => {
  const [state, setState] = useState({
    // Backend Connection
    backendUrl: 'http://localhost:5000',
    sessionId: `session_${Date.now()}`,
    
    // Professors (will be fetched from backend)
    professors: {},
    selectedProfessor: 'maki',
    userPoints: 500,
    
    // Voice Flow
    isListening: false,
    isProcessing: false,
    isGeneratingAudio: false,
    isPlayingAudio: false,
    transcribedText: '',
    currentSentiment: 'neutral',
    mediaRecorder: null,
    audioChunks: [],
    
    // Chat
    messages: [
      {
        id: 1,
        text: "Welcome to MAKIA Oracle! How can I help you today?",
        isBot: true,
        timestamp: new Date(),
        professor: 'MAKI'
      }
    ],
    inputText: '',
    
    // UI
    stars: [],
    showSuggestions: false,
    showSettings: false,
    error: null,
    
    // Audio
    currentAudio: null
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const audioRef = useRef(null);

  // Rive Animation Hook
  const { RiveComponent, rive } = useRive({
    src: "/oracle2.riv",
    stateMachines: "State Machine 1",
    autoplay: true,
  });

  // Fetch professors from backend
  useEffect(() => {
    const fetchProfessors = async () => {
      try {
        const response = await fetch(`${state.backendUrl}/api/professors`);
        if (response.ok) {
          const data = await response.json();
          const professorsData = {};
          
          // Convert professors array to object with additional frontend data
          data.professors.forEach(prof => {
            professorsData[prof.id] = {
              ...prof,
              avatar: prof.id === 'maki' ? '🤓' : prof.id === 'kukulcan' ? '😎' : '👨‍🏫',
              color: prof.id === 'maki' ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' :
                     prof.id === 'kukulcan' ? 'linear-gradient(135deg, #10B981, #059669)' :
                     'linear-gradient(135deg, #DC2626, #991B1B)'
            };
          });
          
          setState(prev => ({ 
            ...prev, 
            professors: professorsData,
            selectedProfessor: Object.keys(professorsData)[0] || 'maki'
          }));
        } else {
          console.error('Failed to fetch professors');
        }
      } catch (error) {
        console.error('Error fetching professors:', error);
        // Fallback to default professors if backend is not available
        setState(prev => ({
          ...prev,
          professors: {
            maki: {
              id: 'maki',
              name: 'MAKI',
              personality: 'nerd',
              avatar: '🤓',
              color: 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
            }
          }
        }));
      }
    };

    fetchProfessors();
  }, [state.backendUrl]);

  // Generate responsive stars
  useEffect(() => {
    const generateStars = () => {
      const stars = [];
      const screenWidth = window.innerWidth;
      const starCount = screenWidth < 768 ? 60 : screenWidth < 1024 ? 80 : 120;
      
      for (let i = 0; i < starCount; i++) {
        stars.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 3 + 1,
          opacity: Math.random() * 0.8 + 0.3,
          delay: Math.random() * 4,
          type: Math.random() > 0.8 ? 'special' : 'normal'
        });
      }
      setState(prev => ({ ...prev, stars }));
    };

    generateStars();
    window.addEventListener('resize', generateStars);
    return () => window.removeEventListener('resize', generateStars);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Control Rive animation states based on voice activity
  useEffect(() => {
    if (rive) {
      try {
        if (state.isListening) {
          rive.setTextRunValue("mode", "listening");
        } else if (state.isProcessing) {
          rive.setTextRunValue("mode", "processing");
        } else if (state.isGeneratingAudio) {
          rive.setTextRunValue("mode", "generating");
        } else if (state.isPlayingAudio) {
          rive.setTextRunValue("mode", "speaking");
        } else {
          rive.setTextRunValue("mode", "idle");
        }
      } catch (error) {
        console.log("Rive state control not available:", error);
      }
    }
  }, [rive, state.isListening, state.isProcessing, state.isGeneratingAudio, state.isPlayingAudio]);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio.src = '';
      }
    };
  }, []);

  // Initialize media recorder
  const initializeMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      let audioChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        await sendVoiceToBackend(audioBlob);
        audioChunks = [];
        
        // Stop the stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      setState(prev => ({ ...prev, mediaRecorder, audioChunks: [] }));
      return mediaRecorder;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Unable to access microphone. Please check permissions.' 
      }));
      throw error;
    }
  };

  // Send voice to backend
  const sendVoiceToBackend = async (audioBlob) => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('professor', state.selectedProfessor);
      formData.append('sessionId', state.sessionId);
      
      const response = await fetch(`${state.backendUrl}/api/voice`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Add user message (transcription)
        const userMessage = {
          id: Date.now(),
          text: data.transcription,
          isBot: false,
          timestamp: new Date()
        };
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, userMessage],
          transcribedText: data.transcription,
          currentSentiment: data.sentiment,
          isProcessing: false,
          isGeneratingAudio: true
        }));
        
        // Play the audio response
        await playAudioResponse(data.audioUrl);
        
        // Add bot message
        const botMessage = {
          id: Date.now() + 1,
          text: data.response,
          isBot: true,
          timestamp: new Date(),
          professor: data.professor,
          pointsEarned: data.pointsEarned
        };
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, botMessage],
          userPoints: prev.userPoints + data.pointsEarned,
          isGeneratingAudio: false
        }));
        
      } else {
        throw new Error(data.error || 'Unknown error from backend');
      }
      
    } catch (error) {
      console.error('Error sending voice to backend:', error);
      setState(prev => ({ 
        ...prev, 
        error: `Voice processing failed: ${error.message}`,
        isProcessing: false,
        isGeneratingAudio: false,
        isPlayingAudio: false
      }));
    }
  };

  // Play audio response from backend
  const playAudioResponse = async (audioUrl) => {
    try {
      setState(prev => ({ ...prev, isPlayingAudio: true }));
      
      const audio = new Audio(`${state.backendUrl}${audioUrl}`);
      
      return new Promise((resolve, reject) => {
        audio.onloadeddata = () => {
          audio.play().catch(reject);
        };
        
        audio.onended = () => {
          setState(prev => ({ ...prev, isPlayingAudio: false, currentAudio: null }));
          resolve();
        };
        
        audio.onerror = () => {
          setState(prev => ({ ...prev, isPlayingAudio: false, currentAudio: null }));
          reject(new Error('Audio playback failed'));
        };
        
        setState(prev => ({ ...prev, currentAudio: audio }));
      });
      
    } catch (error) {
      console.error('Error playing audio:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Audio playback failed',
        isPlayingAudio: false,
        currentAudio: null
      }));
    }
  };

  // Voice Flow Implementation with Real Backend
  const handleVoiceFlow = async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      if (state.isListening) {
        // Stop recording
        if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
          state.mediaRecorder.stop();
          setState(prev => ({ ...prev, isListening: false }));
        }
        return;
      }
      
      // Start recording
      setState(prev => ({ ...prev, isListening: true, transcribedText: '', showSuggestions: false }));
      
      let mediaRecorder = state.mediaRecorder;
      if (!mediaRecorder) {
        mediaRecorder = await initializeMediaRecorder();
      }
      
      if (mediaRecorder) {
        mediaRecorder.start(1000); // Collect data every second
        
        // Auto-stop after 10 seconds
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            setState(prev => ({ ...prev, isListening: false }));
          }
        }, 10000);
      }
      
    } catch (error) {
      console.error('Voice flow error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error.message,
        isListening: false, 
        isProcessing: false, 
        isGeneratingAudio: false, 
        isPlayingAudio: false
      }));
    }
  };

  // Send text message to backend
  const sendMessage = async () => {
    if (state.inputText.trim()) {
      try {
        setState(prev => ({ ...prev, error: null }));
        
        const userMessage = {
          id: Date.now(),
          text: state.inputText,
          isBot: false,
          timestamp: new Date()
        };
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, userMessage],
          inputText: '',
          showSuggestions: false
        }));
        
        // Send to backend
        const response = await fetch(`${state.backendUrl}/api/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: state.inputText,
            professor: state.selectedProfessor,
            sessionId: state.sessionId
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Backend error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          const botMessage = {
            id: Date.now() + 1,
            text: data.response,
            isBot: true,
            timestamp: new Date(),
            professor: data.professor,
            pointsEarned: data.pointsEarned
          };
          
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, botMessage],
            userPoints: prev.userPoints + data.pointsEarned
          }));
        } else {
          throw new Error(data.error || 'Unknown error from backend');
        }
        
      } catch (error) {
        console.error('Error sending message:', error);
        setState(prev => ({ 
          ...prev, 
          error: `Message sending failed: ${error.message}`
        }));
      }
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    setState(prev => ({ ...prev, showSuggestions: true }));
  };

  // Handle suggestion click
  const handleSuggestion = (suggestion) => {
    setState(prev => ({ 
      ...prev, 
      inputText: suggestion,
      showSuggestions: false
    }));
    inputRef.current?.focus();
  };

  // Change professor
  const changeProfessor = () => {
    const profKeys = Object.keys(state.professors);
    if (profKeys.length > 0) {
      const currentIndex = profKeys.indexOf(state.selectedProfessor);
      const nextIndex = (currentIndex + 1) % profKeys.length;
      setState(prev => ({ ...prev, selectedProfessor: profKeys[nextIndex] }));
    }
  };

  // Clear error
  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  // Update backend URL
  const updateBackendUrl = (newUrl) => {
    setState(prev => ({ ...prev, backendUrl: newUrl }));
  };

  const currentProfessor = state.professors[state.selectedProfessor] || { name: 'Loading...', avatar: '⏳', color: 'linear-gradient(135deg, #6B7280, #4B5563)' };
  const isVoiceActive = state.isListening || state.isProcessing || state.isGeneratingAudio || state.isPlayingAudio;

  // Suggestions
  const suggestions = [
    "What is Machine Learning?",
    "Explain Neural Networks",
    "How does AI work?",
    "Deep Learning basics"
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Error Toast */}
      {state.error && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 100,
          background: 'rgba(220, 38, 38, 0.9)',
          color: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          maxWidth: '400px',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(239, 68, 68, 0.5)'
        }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: '0.875rem', flex: 1 }}>{state.error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '0.25rem'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Settings Modal */}
      {state.showSettings && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(17, 24, 39, 0.95)',
            backdropFilter: 'blur(16px)',
            borderRadius: '1rem',
            padding: '2rem',
            border: '1px solid rgba(75, 85, 99, 1)',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ color: 'white', marginBottom: '1rem', margin: '0 0 1rem 0' }}>Settings</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: 'rgba(209, 213, 219, 1)', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                Backend URL:
              </label>
              <input
                type="text"
                value={state.backendUrl}
                onChange={(e) => updateBackendUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(55, 65, 81, 0.9)',
                  border: '1px solid rgba(75, 85, 99, 1)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '0.875rem'
                }}
                placeholder="http://localhost:5000"
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: 'rgba(209, 213, 219, 1)', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                Session ID:
              </label>
              <input
                type="text"
                value={state.sessionId}
                readOnly
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(55, 65, 81, 0.5)',
                  border: '1px solid rgba(75, 85, 99, 1)',
                  borderRadius: '0.5rem',
                  color: 'rgba(156, 163, 175, 1)',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setState(prev => ({ ...prev, showSettings: false }))}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(75, 85, 99, 0.8)',
                  color: 'white',
                  border: '1px solid rgba(107, 114, 128, 1)',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Responsive Stars Background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {state.stars.map(star => (
          <div key={star.id}>
            {star.type === 'special' ? (
              <div
                style={{
                  position: 'absolute',
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  fontSize: `${star.size * 4}px`,
                  opacity: star.opacity,
                  animation: `twinkle ${3 + star.delay}s ease-in-out infinite`,
                  animationDelay: `${star.delay}s`,
                  color: '#bfdbfe'
                }}
              >
                ✦
              </div>
            ) : (
              <div
                style={{
                  position: 'absolute',
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  opacity: star.opacity,
                  animation: `twinkle 3s ease-in-out infinite`,
                  animationDelay: `${star.delay}s`,
                  borderRadius: '50%',
                  backgroundColor: '#bfdbfe'
                }}
              />
            )}
          </div>
        ))}
        
        {/* Constellation Lines */}
        <svg style={{ 
          position: 'absolute', 
          inset: 0, 
          width: '100%', 
          height: '100%', 
          opacity: 0.1, 
          pointerEvents: 'none' 
        }}>
          <defs>
            <linearGradient id="constellation" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#14b8a6" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path
            d="M 10 20 Q 200 80 400 40 T 800 60"
            stroke="url(#constellation)"
            strokeWidth="1"
            fill="none"
            style={{ animation: 'pulse 3s ease-in-out infinite' }}
          />
          <path
            d="M 100 300 Q 300 200 500 280 T 900 250"
            stroke="url(#constellation)"
            strokeWidth="1"
            fill="none"
            style={{ animation: 'pulse 3s ease-in-out infinite', animationDelay: '2s' }}
          />
        </svg>
        
        {/* Maya Pattern Decorations */}
        <div style={{ 
          position: 'absolute', 
          top: '5rem', 
          right: window.innerWidth >= 768 ? '2rem' : '1rem', 
          opacity: 0.2 
        }}>
          <div style={{
            width: window.innerWidth >= 1024 ? '4rem' : window.innerWidth >= 768 ? '3rem' : '2rem',
            height: window.innerWidth >= 1024 ? '4rem' : window.innerWidth >= 768 ? '3rem' : '2rem',
            border: '2px solid #14b8a6',
            transform: 'rotate(45deg)',
            animation: 'pulse 3s ease-in-out infinite'
          }}></div>
        </div>
        <div style={{ 
          position: 'absolute', 
          bottom: '10rem', 
          left: window.innerWidth >= 768 ? '2rem' : '1rem', 
          opacity: 0.2 
        }}>
          <div style={{
            width: window.innerWidth >= 1024 ? '3rem' : window.innerWidth >= 768 ? '2rem' : '1.5rem',
            height: window.innerWidth >= 1024 ? '3rem' : window.innerWidth >= 768 ? '2rem' : '1.5rem',
            border: '2px solid #a855f7',
            transform: 'rotate(12deg)',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '1s'
          }}></div>
        </div>
        <div style={{ 
          position: 'absolute', 
          top: '33%', 
          left: '25%', 
          opacity: 0.1 
        }}>
          <div style={{
            width: window.innerWidth >= 768 ? '1.5rem' : '1rem',
            height: window.innerWidth >= 768 ? '1.5rem' : '1rem',
            border: '1px solid #06b6d4',
            borderRadius: '50%',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '3s'
          }}></div>
        </div>
      </div>

      {/* Header */}
      <nav style={{
        position: 'relative',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: window.innerWidth >= 768 ? '1.5rem' : '1rem',
        background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.95) 0%, rgba(88, 28, 135, 0.95) 100%)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(20, 184, 166, 0.3)',
        flexShrink: 0
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: window.innerWidth >= 768 ? '1rem' : '0.75rem' 
        }}>
          <div style={{
            width: window.innerWidth >= 768 ? '2.5rem' : '2rem',
            height: window.innerWidth >= 768 ? '2.5rem' : '2rem',
            background: 'linear-gradient(135deg, #14b8a6, #10b981)',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: window.innerWidth >= 768 ? '1.125rem' : '1rem'
          }}>
            🔷
          </div>
          <div>
            <h1 style={{
              fontSize: window.innerWidth >= 768 ? '1.5rem' : '1.25rem',
              fontWeight: 'bold',
              color: 'white',
              margin: 0,
              fontFamily: 'Poppins, sans-serif'
            }}>
              MAKIA
            </h1>
            {window.innerWidth >= 640 && (
              <p style={{
                fontSize: '0.75rem',
                color: 'rgba(94, 234, 212, 0.8)',
                margin: 0,
                fontFamily: 'Poppins, sans-serif'
              }}>
                Sabiduría Ancestral IA
              </p>
            )}
          </div>
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: window.innerWidth >= 768 ? '1.5rem' : '1rem' 
        }}>
          {/* Settings Button */}
          <button
            onClick={() => setState(prev => ({ ...prev, showSettings: true }))}
            style={{
              padding: '0.5rem',
              background: 'rgba(75, 85, 99, 0.8)',
              border: '1px solid rgba(107, 114, 128, 1)',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Settings"
          >
            <Settings size={16} />
          </button>
          
          {/* Points */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'linear-gradient(90deg, rgba(5, 150, 105, 0.9) 0%, rgba(13, 148, 136, 0.9) 100%)',
            padding: window.innerWidth >= 768 ? '0.5rem 1rem' : '0.5rem 0.75rem',
            borderRadius: '9999px',
            border: '1px solid rgba(16, 185, 129, 0.5)'
          }}>
            <Star size={window.innerWidth >= 768 ? 20 : 16} style={{ color: '#fbbf24' }} />
            <span style={{ 
              fontWeight: 'bold', 
              color: 'white', 
              fontSize: window.innerWidth >= 768 ? '1rem' : '0.875rem',
              fontFamily: 'Poppins, sans-serif'
            }}>
              {state.userPoints}
            </span>
            {window.innerWidth >= 640 && (
              <span style={{ 
                color: 'rgba(167, 243, 208, 1)', 
                fontSize: '0.875rem',
                fontFamily: 'Poppins, sans-serif'
              }}>
                POINTS
              </span>
            )}
          </div>
          
          {/* Professor Icon */}
          <button
            onClick={changeProfessor}
            style={{
              width: window.innerWidth >= 768 ? '3rem' : '2.5rem',
              height: window.innerWidth >= 768 ? '3rem' : '2.5rem',
              borderRadius: '50%',
              border: '2px solid #14b8a6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: window.innerWidth >= 768 ? '1.5rem' : '1.25rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              background: currentProfessor.color
            }}
            title={`Current: ${currentProfessor.name} - Click to change`}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {currentProfessor.avatar}
          </button>
        </div>
      </nav>

      {/* Main Content Container */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }}>
        
        {/* Oracle of Knowledge with Enhanced Styling */}
        <div style={{ 
          textAlign: 'center', 
          padding: window.innerWidth >= 768 ? '2rem 2rem 1rem' : '1.5rem 1rem 1rem', 
          position: 'relative',
          flexShrink: 0
        }}>
          {/* Título Principal con Efectos Estrellados */}
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            {/* Fondo con efectos */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, rgba(6, 182, 212, 0.05) 50%, transparent 100%)',
              filter: 'blur(20px)',
              transform: 'scale(1.2)'
            }}></div>
            
            {/* Partículas flotantes alrededor del título */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: '20%',
                left: '10%',
                width: '4px',
                height: '4px',
                background: '#06b6d4',
                borderRadius: '50%',
                animation: 'twinkle 2s ease-in-out infinite'
              }}></div>
              <div style={{
                position: 'absolute',
                top: '30%',
                right: '15%',
                fontSize: '8px',
                color: '#a855f7',
                animation: 'twinkle 3s ease-in-out infinite',
                animationDelay: '1s'
              }}>✦</div>
              <div style={{
                position: 'absolute',
                bottom: '25%',
                left: '20%',
                width: '3px',
                height: '3px',
                background: '#10b981',
                borderRadius: '50%',
                animation: 'twinkle 2.5s ease-in-out infinite',
                animationDelay: '0.5s'
              }}></div>
              <div style={{
                position: 'absolute',
                bottom: '20%',
                right: '25%',
                fontSize: '6px',
                color: '#06b6d4',
                animation: 'twinkle 2.8s ease-in-out infinite',
                animationDelay: '1.5s'
              }}>✧</div>
            </div>
            
            <h1 style={{
              fontSize: window.innerWidth >= 1024 ? '2.5rem' : window.innerWidth >= 768 ? '2rem' : '1.5rem',
              fontWeight: '600',
              fontFamily: 'Poppins, sans-serif',
              marginBottom: '0.5rem',
              position: 'relative',
              zIndex: 10,
              margin: '0 0 0.5rem 0',
              background: 'linear-gradient(135deg, #06b6d4, #a855f7, #10b981)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textShadow: '0 0 30px rgba(6, 182, 212, 0.5)',
              letterSpacing: '0.05em'
            }}>
              Oracle of Knowledge
            </h1>
            
            {/* Línea decorativa con estrellas */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '0.75rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                height: '1px',
                width: '3rem',
                background: 'linear-gradient(to right, transparent, #06b6d4, transparent)'
              }}></div>
              <div style={{
                fontSize: '0.75rem',
                color: '#06b6d4',
                animation: 'twinkle 2s ease-in-out infinite'
              }}>✦</div>
              <div style={{
                height: '1px',
                width: '4rem',
                background: 'linear-gradient(to right, #06b6d4, #a855f7, #10b981)'
              }}></div>
              <div style={{
                fontSize: '0.75rem',
                color: '#a855f7',
                animation: 'twinkle 2s ease-in-out infinite',
                animationDelay: '1s'
              }}>✧</div>
              <div style={{
                height: '1px',
                width: '3rem',
                background: 'linear-gradient(to left, transparent, #10b981, transparent)'
              }}></div>
            </div>
          </div>
          
          {/* Subtítulo sobre Profesor AI */}
          <div style={{
            marginBottom: '1.5rem',
            maxWidth: '600px',
            margin: '0 auto 1.5rem auto'
          }}>
            <p style={{
              fontSize: window.innerWidth >= 768 ? '1rem' : '0.875rem',
              color: 'rgba(209, 213, 219, 0.9)',
              fontFamily: 'Poppins, sans-serif',
              lineHeight: '1.6',
              margin: '0 0 0.5rem 0',
              background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              fontWeight: '500'
            }}>
              🤖 Your personal AI professor
            </p>
            <p style={{
              fontSize: window.innerWidth >= 768 ? '0.875rem' : '0.75rem',
              color: 'rgba(156, 163, 175, 0.8)',
              fontFamily: 'Poppins, sans-serif',
              lineHeight: '1.5',
              margin: 0,
              maxWidth: '500px',
              margin: '0 auto'
            }}>
              Learn about AI, Machine Learning and cutting'edge technology with custom explications and practical examples. Ask what you want! I am here to help you.
            </p>
          </div>
          
          {/* Rive Animation Container */}
          <div style={{
            position: 'relative',
            margin: '0 auto',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {/* Background Glow Effect */}
            <div style={{
              position: 'absolute',
              width: window.innerWidth >= 1024 ? '24rem' : window.innerWidth >= 768 ? '20rem' : '16rem',
              height: window.innerWidth >= 1024 ? '24rem' : window.innerWidth >= 768 ? '20rem' : '16rem',
              borderRadius: '50%',
              background: isVoiceActive 
                ? 'radial-gradient(circle, rgba(251, 191, 36, 0.2) 0%, rgba(251, 191, 36, 0.05) 50%, transparent 100%)'
                : 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.05) 50%, transparent 100%)',
              animation: 'pulse 2s ease-in-out infinite',
              transition: 'all 0.5s ease'
            }}></div>
            
            {/* Rive Animation */}
            <div style={{
              position: 'relative',
              zIndex: 5,
              filter: isVoiceActive ? 'brightness(1.3) saturate(1.2)' : 'brightness(1)',
              transition: 'all 0.5s ease'
            }}>
              <RiveComponent 
                style={{ 
                  width: window.innerWidth >= 1024 ? 350 : window.innerWidth >= 768 ? 300 : 250, 
                  height: window.innerWidth >= 1024 ? 350 : window.innerWidth >= 768 ? 300 : 250 
                }} 
              />
            </div>
            
            {/* Orbital Rings around Rive */}
            <div style={{
              position: 'absolute',
              width: window.innerWidth >= 1024 ? '22rem' : window.innerWidth >= 768 ? '18rem' : '14rem',
              height: window.innerWidth >= 1024 ? '22rem' : window.innerWidth >= 768 ? '18rem' : '14rem',
              borderRadius: '50%',
              border: '1px solid',
              borderColor: isVoiceActive ? 'rgba(251, 191, 36, 0.3)' : 'rgba(6, 182, 212, 0.2)',
              animation: `spin ${isVoiceActive ? '8s' : '20s'} linear infinite`,
              transition: 'all 0.5s ease'
            }}></div>
            <div style={{
              position: 'absolute',
              width: window.innerWidth >= 1024 ? '26rem' : window.innerWidth >= 768 ? '22rem' : '18rem',
              height: window.innerWidth >= 1024 ? '26rem' : window.innerWidth >= 768 ? '22rem' : '18rem',
              borderRadius: '50%',
              border: '1px solid',
              borderColor: isVoiceActive ? 'rgba(249, 115, 22, 0.2)' : 'rgba(168, 85, 247, 0.15)',
              animation: `spin ${isVoiceActive ? '15s' : '30s'} linear infinite reverse`,
              transition: 'all 0.5s ease'
            }}></div>
          </div>

          {/* Voice Status Overlay */}
          {isVoiceActive && (
            <div style={{
              position: 'absolute',
              bottom: '0.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20
            }}>
              <div style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(12px)',
                borderRadius: '1rem',
                padding: '1rem 1.5rem',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                minWidth: '200px'
              }}>
                {state.isListening && (
                  <div style={{
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    fontFamily: 'Poppins, sans-serif'
                  }}>
                    <Mic size={20} style={{ animation: 'bounce 1s infinite' }} />
                    <span style={{ fontWeight: '500' }}>Listening...</span>
                  </div>
                )}
                {state.isProcessing && (
                  <div style={{
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    fontFamily: 'Poppins, sans-serif'
                  }}>
                    <Brain size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontWeight: '500' }}>Processing...</span>
                    {state.transcribedText && (
                      <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'rgba(209, 213, 219, 1)' }}>
                        "{state.transcribedText}"
                      </div>
                    )}
                  </div>
                )}
                {state.isGeneratingAudio && (
                  <div style={{
                    color: '#a855f7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    fontFamily: 'Poppins, sans-serif'
                  }}>
                    <Sparkles size={20} style={{ animation: 'pulse 2s infinite' }} />
                    <span style={{ fontWeight: '500' }}>Generating audio...</span>
                  </div>
                )}
                {state.isPlayingAudio && (
                  <div style={{
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    fontFamily: 'Poppins, sans-serif'
                  }}>
                    <Volume2 size={20} style={{ animation: 'bounce 1s infinite' }} />
                    <span style={{ fontWeight: '500' }}>Playing response...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: window.innerWidth >= 768 ? '0 1.5rem' : '0 1rem',
          minHeight: 0
        }}>
          <div style={{
            maxWidth: '64rem',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            paddingBottom: '1rem'
          }}>
            {state.messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: message.isBot ? 'flex-start' : 'flex-end'
                }}
              >
                <div
                  style={{
                    maxWidth: window.innerWidth >= 768 ? '32rem' : '20rem',
                    padding: window.innerWidth >= 768 ? '0.75rem 1rem' : '0.5rem 0.75rem',
                    borderRadius: '1.5rem',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid',
                    boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)',
                    background: message.isBot
                      ? 'rgba(55, 65, 81, 0.9)'
                      : 'linear-gradient(90deg, rgba(59, 130, 246, 0.9) 0%, rgba(168, 85, 247, 0.9) 100%)',
                    borderColor: message.isBot ? 'rgba(75, 85, 99, 1)' : 'rgba(59, 130, 246, 0.5)',
                    color: message.isBot ? 'rgba(229, 231, 235, 1)' : 'white',
                    borderTopLeftRadius: message.isBot ? 0 : '1.5rem',
                    borderTopRightRadius: message.isBot ? '1.5rem' : 0,
                    fontFamily: 'Poppins, sans-serif'
                  }}
                >
                  <p style={{ 
                    fontSize: window.innerWidth >= 768 ? '1rem' : '0.875rem',
                    margin: 0,
                    marginBottom: '0.5rem',
                    lineHeight: '1.5'
                  }}>
                    {message.text}
                  </p>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <p style={{
                      fontSize: '0.75rem',
                      color: message.isBot ? 'rgba(156, 163, 175, 1)' : 'rgba(191, 219, 254, 1)',
                      margin: 0
                    }}>
                      {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    {message.professor && (
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#10b981',
                        fontWeight: '500'
                      }}>
                        {message.professor} {message.pointsEarned && `+${message.pointsEarned}pts`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div style={{
          padding: window.innerWidth >= 768 ? '1rem 1.5rem 1.5rem' : '1rem 1rem 1rem',
          flexShrink: 0
        }}>
          <div style={{
            maxWidth: '64rem',
            margin: '0 auto',
            position: 'relative'
          }}>
            
            {/* Suggestions */}
            {state.showSuggestions && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                marginBottom: '1rem',
                width: '100%'
              }}>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'rgba(209, 213, 219, 1)',
                  marginBottom: '0.75rem',
                  fontWeight: '500',
                  margin: '0 0 0.75rem 0',
                  fontFamily: 'Poppins, sans-serif'
                }}>
                  might interest you:
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: window.innerWidth >= 640 ? 'repeat(2, 1fr)' : '1fr',
                  gap: '0.5rem'
                }}>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestion(suggestion)}
                      style={{
                        padding: window.innerWidth >= 768 ? '0.75rem 1rem' : '0.5rem 0.75rem',
                        background: 'rgba(55, 65, 81, 0.9)',
                        border: '1px solid rgba(75, 85, 99, 1)',
                        color: 'rgba(229, 231, 235, 1)',
                        borderRadius: '0.75rem',
                        fontSize: window.innerWidth >= 768 ? '0.875rem' : '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backdropFilter: 'blur(8px)',
                        textAlign: 'left',
                        fontFamily: 'Poppins, sans-serif'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(75, 85, 99, 0.9)';
                        e.target.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(55, 65, 81, 0.9)';
                        e.target.style.borderColor = 'rgba(75, 85, 99, 1)';
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Box */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: window.innerWidth >= 768 ? '0.75rem' : '0.5rem',
              padding: window.innerWidth >= 768 ? '1rem' : '0.75rem',
              background: 'rgba(17, 24, 39, 0.9)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(75, 85, 99, 1)',
              borderRadius: '1.5rem'
            }}>
              <input
                ref={inputRef}
                type="text"
                value={state.inputText}
                onChange={(e) => setState(prev => ({ ...prev, inputText: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                onFocus={handleInputFocus}
                onBlur={() => setTimeout(() => setState(prev => ({ ...prev, showSuggestions: false })), 200)}
                placeholder="Type your message here..."
                disabled={isVoiceActive}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: 'white',
                  outline: 'none',
                  border: 'none',
                  fontSize: window.innerWidth >= 768 ? '1.125rem' : '1rem',
                  opacity: isVoiceActive ? 0.5 : 1,
                  fontFamily: 'Poppins, sans-serif'
                }}
              />
              
              <button
                onClick={handleVoiceFlow}
                disabled={state.isProcessing || state.isGeneratingAudio || state.isPlayingAudio}
                style={{
                  padding: window.innerWidth >= 768 ? '0.75rem' : '0.5rem',
                  borderRadius: '0.75rem',
                  border: '1px solid',
                  cursor: (state.isProcessing || state.isGeneratingAudio || state.isPlayingAudio) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  background: state.isListening
                    ? 'rgba(220, 38, 38, 0.8)'
                    : (state.isProcessing || state.isGeneratingAudio || state.isPlayingAudio)
                      ? 'rgba(75, 85, 99, 0.8)'
                      : 'rgba(5, 150, 105, 0.8)',
                  borderColor: state.isListening
                    ? '#dc2626'
                    : (state.isProcessing || state.isGeneratingAudio || state.isPlayingAudio)
                      ? 'rgba(107, 114, 128, 1)'
                      : '#10b981',
                  color: (state.isProcessing || state.isGeneratingAudio || state.isPlayingAudio) ? 'rgba(156, 163, 175, 1)' : 'white',
                  opacity: (state.isProcessing || state.isGeneratingAudio || state.isPlayingAudio) ? 0.6 : 1
                }}
                title={state.isListening ? "Stop Recording (or wait 10s)" : "Voice"}
              >
                {state.isListening ? 
                  <MicOff size={window.innerWidth >= 768 ? 20 : 18} /> : 
                  <Mic size={window.innerWidth >= 768 ? 20 : 18} />
                }
              </button>
              
              <button
                onClick={sendMessage}
                disabled={!state.inputText.trim() || isVoiceActive}
                style={{
                  padding: window.innerWidth >= 768 ? '0.75rem' : '0.5rem',
                  background: 'rgba(59, 130, 246, 0.8)',
                  color: 'white',
                  borderRadius: '0.75rem',
                  border: '1px solid #3b82f6',
                  cursor: (!state.inputText.trim() || isVoiceActive) ? 'not-allowed' : 'pointer',
                  opacity: (!state.inputText.trim() || isVoiceActive) ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
                title="Send"
                onMouseEnter={(e) => {
                  if (state.inputText.trim() && !isVoiceActive) {
                    e.target.style.background = 'rgba(37, 99, 235, 0.8)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (state.inputText.trim() && !isVoiceActive) {
                    e.target.style.background = 'rgba(59, 130, 246, 0.8)';
                  }
                }}
              >
                <Send size={window.innerWidth >= 768 ? 20 : 18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        position: 'relative',
        zIndex: 40,
        textAlign: 'center',
        padding: '1rem',
        color: 'rgba(156, 163, 175, 1)',
        fontSize: '0.875rem',
        background: 'linear-gradient(to top, rgba(15, 23, 42, 0.9) 0%, transparent 100%)',
        borderTop: '1px solid rgba(75, 85, 99, 0.5)',
        flexShrink: 0,
        fontFamily: 'Poppins, sans-serif'
      }}>
        © AI MEXICO & FILIPINAS TEAM MACHAKAI
      </footer>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        
        @keyframes bounce {
          0%, 100% {
            transform: translateY(-25%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: none;
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        
        @keyframes float {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg);
            opacity: 0.6;
          }
          50% { 
            transform: translateY(-20px) rotate(180deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default MAKIA_ORACLE;