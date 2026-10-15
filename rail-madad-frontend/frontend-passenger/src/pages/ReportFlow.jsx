import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  HelpCircle,
  Camera,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Send,
  Users,
  Sparkles,
  X,
  ChevronRight,
  MessageCircle,
  Mic,
  Video,
  Square,
  Play,
  Trash2,
  MapPin,
  RefreshCw,
  Volume2,
  FileText,
  Upload,
} from "lucide-react";
import {
  MOCK_TRAINS as REAL_TRAINS,
  MOCK_COACHES,
  MOCK_BOT_RESPONSES,
} from "../data/mockData";

import axiosClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";

const ML_URL = import.meta.env.VITE_ML_URL || "http://localhost:8000";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function ReportFlow() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const prefill = routerLocation.state?.prefill || null;
  const { user } = useAuth();
  const [flowStep, setFlowStep] = useState(1); // 1 = Capture & Details, 2 = Photo Quality, 3 = Status
  const [submitting, setSubmitting] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);

  const fallbackTimeline = [
    { status: "Submitted", completed: true },
    { status: "Verified", completed: false },
    { status: "Routed to Department", completed: false },
    { status: "Resolved", completed: false },
  ];

  const getTimelineSteps = () => {
    const rawTimeline =
      submittedComplaint?.timeline && submittedComplaint.timeline.length
        ? submittedComplaint.timeline
        : fallbackTimeline;
    return rawTimeline.map((step, idx) => ({
      ...step,
      status: step.status,
      completed:
        Boolean(step.completed) ||
        (submittedComplaint?.status &&
          idx < getStatusIndex(submittedComplaint.status)),
    }));
  };

  const getStatusIndex = (statusValue) => {
    const normalized = String(statusValue || "").trim();
    const statusOrder = [
      "Submitted",
      "Verified",
      "Routed to Department",
      "Resolved",
    ];
    const matchedIndex = statusOrder.findIndex(
      (step) => step.toLowerCase() === normalized.toLowerCase(),
    );
    return matchedIndex >= 0 ? matchedIndex : 0;
  };

  useEffect(() => {
    if (!submittedComplaint?.complaintId || flowStep !== 3) return;

    const refreshComplaintStatus = async () => {
      try {
        const res = await axiosClient.get(
          `/complaints/track/${submittedComplaint.complaintId}`,
        );
        if (res.data && res.data.status) {
          setSubmittedComplaint((prev) => ({ ...prev, ...res.data }));
        }
      } catch (err) {
        console.warn("Complaint status refresh failed:", err.message);
      }
    };

    refreshComplaintStatus();
    const timer = setInterval(refreshComplaintStatus, 5000);
    return () => clearInterval(timer);
  }, [submittedComplaint?.complaintId, flowStep]);

  // Require login before submitting issue
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  // Form State
  const [image, setImage] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  // AI Conversion State (frontend inference via HuggingFace)
  const [aiConversions, setAiConversions] = useState({
    imageText: "",
    audioText: "",
    videoText: "",
  });
  const [aiConverting, setAiConverting] = useState({
    image: false,
    audio: false,
    video: false,
  });

  // Structured LLM Multi-Modal Analysis State (OpenRouter AI)
  const [llmAnalysis, setLlmAnalysis] = useState(null);
  const [analyzingLlm, setAnalyzingLlm] = useState(false);

  const runNemotronAnalysis = async (
    customDesc,
    customImageText,
    customAudioText,
    customVideoText,
  ) => {
    const textVal = customDesc !== undefined ? customDesc : description;
    const imgVal =
      customImageText !== undefined ? customImageText : aiConversions.imageText;
    const audVal =
      customAudioText !== undefined ? customAudioText : aiConversions.audioText;
    const vidVal =
      customVideoText !== undefined ? customVideoText : aiConversions.videoText;

    if (!textVal && !imgVal && !audVal && !vidVal) return;

    setAnalyzingLlm(true);
    try {
      const response = await fetch(`${ML_URL}/analyze-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textVal,
          image: imgVal,
          audio: audVal,
          video: vidVal,
          trainNumber,
          coach,
          pnr,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        setLlmAnalysis(result);
      }
    } catch (err) {
      console.warn("Nemotron analysis error:", err.message);
    } finally {
      setAnalyzingLlm(false);
    }
  };

  // Active Media Recorders / In-App Media States
  const [activeTab, setActiveTab] = useState("photo"); // 'photo' | 'audio' | 'video'
  const [cameraActive, setCameraActive] = useState(false);
  const [videoRecorderActive, setVideoRecorderActive] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);

  // References
  const videoRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const speechTranscriptRef = useRef("");

  // Location State
  const [location, setLocation] = useState({
    lat: null,
    lng: null,
    status: "fetching",
    address: "",
  });

  // Input Details State — prefilled from active journey if navigated from home banner
  const [showAiDetection, setShowAiDetection] = useState(false);
  const [trainNumber, setTrainNumber] = useState(prefill?.trainNumber || "");
  const [showTrainSuggest, setShowTrainSuggest] = useState(false);
  const [coach, setCoach] = useState(prefill?.coach || "");
  const [showCoachSuggest, setShowCoachSuggest] = useState(false);
  const [pnr, setPnr] = useState(prefill?.pnr || "");
  const [description, setDescription] = useState("");
  // Lock fields if prefilled from journey
  const journeyLocked = !!prefill;

  // ── AI Media-to-Text Services (BLIP-2, Whisper & ML Captioning) ────
  const ML_SERVICE_URL =
    import.meta.env.VITE_ML_SERVICE_URL ||
    `${API_BASE}/complaints`;
  const HF_TOKEN = import.meta.env.VITE_HF_TOKEN || "";

  // 1. Image to Text using OpenRouter AI Vision / BLIP Model (Python ML Service & API endpoint)
  async function generateImageCaption(imageBase64) {
    if (!imageBase64) return "";

    // Attempt 1: Call Python ML Service directly on port 8000
    try {
      const response = await fetch(`${ML_URL}/caption-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
        signal: AbortSignal.timeout(60000), // 60s timeout for LLM vision processing
      });
      if (response.ok) {
        const data = await response.json();
        if (data.caption) return data.caption;
      }
    } catch (e) {
      console.warn("Image captioning port 8000 failed:", e.message);
    }

    // Attempt 2: Call main ML_SERVICE_URL endpoint
    try {
      const response = await fetch(`${ML_SERVICE_URL}/caption-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
        signal: AbortSignal.timeout(60000),
      });
      if (response.ok) {
        const data = await response.json();
        return data.caption || "";
      }
    } catch (err) {
      console.warn(
        "Image captioning service unavailable or failed:",
        err.message,
      );
    }
    return "";
  }

  // 2. Audio to Text using OpenAI Whisper Model (Python ML Service & API endpoint)
  async function generateAudioTranscription(audioBlob) {
    let audioBase64 = null;

    if (audioBlob instanceof Blob || audioBlob instanceof File) {
      try {
        audioBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
      } catch (e) {}
    }

    if (!audioBase64 && audioUrl && audioUrl.startsWith("blob:")) {
      try {
        audioBase64 = await blobUrlToBase64(audioUrl);
      } catch (e) {}
    }
    if (!audioBase64) audioBase64 = audioUrl;
    if (!audioBase64) return "";

    // Attempt 1: Call Python ML Service directly on port 8000 (openai/whisper)
    try {
      const response = await fetch(`${ML_URL}/transcribe-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: audioBase64 }),
        signal: AbortSignal.timeout(60000), // 60s timeout for Whisper CPU transcription
      });
      if (response.ok) {
        const data = await response.json();
        if (data.transcription || data.text)
          return data.transcription || data.text;
      }
    } catch (e) {
      console.warn("Audio transcription port 8000 failed:", e.message);
    }

    // Attempt 2: Call main ML_SERVICE_URL endpoint
    try {
      const response = await fetch(`${ML_SERVICE_URL}/transcribe-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: audioBase64 }),
        signal: AbortSignal.timeout(60000),
      });
      if (response.ok) {
        const data = await response.json();
        return data.transcription || data.text || "";
      }
    } catch (err) {
      console.warn(
        "Audio transcription service unavailable or failed:",
        err.message,
      );
    }
    return "";
  }

  // 3. Video to Text Captioning Model (Python ML Service & API endpoint)
  async function generateVideoCaption(videoBlobInput) {
    let videoBase64 = null;
    if (videoBlobInput instanceof Blob || videoBlobInput instanceof File) {
      try {
        videoBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(videoBlobInput);
        });
      } catch (e) {}
    }
    if (!videoBase64 && videoUrl && videoUrl.startsWith("blob:")) {
      try {
        videoBase64 = await blobUrlToBase64(videoUrl);
      } catch (e) {}
    }
    if (!videoBase64) videoBase64 = videoUrl;
    if (!videoBase64) return "";

    // Attempt 1: Call Python ML Service directly on port 8000
    try {
      const response = await fetch(`${ML_URL}/caption-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: videoBase64 }),
        signal: AbortSignal.timeout(120000), // 120s — Whisper+BLIP on CPU can be slow
      });
      if (response.ok) {
        const data = await response.json();
        if (data.caption || data.text) return data.caption || data.text;
      }
    } catch (e) {
      console.warn("Video captioning port 8000 failed:", e.message);
    }

    // Attempt 2: Call main ML_SERVICE_URL endpoint
    try {
      const response = await fetch(`${ML_SERVICE_URL}/caption-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: videoBase64 }),
        signal: AbortSignal.timeout(120000),
      });
      if (response.ok) {
        const data = await response.json();
        return data.caption || data.text || "";
      }
    } catch (err) {
      console.warn(
        "Video captioning service unavailable or failed:",
        err.message,
      );
    }
    return "";
  }

  // Wrapper functions for UI triggering
  const runImageToText = async (base64DataUrl) => {
    setAiConverting((p) => ({ ...p, image: true }));
    const caption = await generateImageCaption(base64DataUrl);
    setAiConversions((p) => ({ ...p, imageText: caption }));
    setAiConverting((p) => ({ ...p, image: false }));
  };

  // Start Web SpeechRecognition alongside MediaRecorder for instant live audio text
  const startSpeechRecognition = (lang = "en-IN") => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    speechTranscriptRef.current = "";
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = lang;
    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          speechTranscriptRef.current += e.results[i][0].transcript + " ";
        }
      }
    };
    recognition.onerror = (e) =>
      console.warn("Speech recognition error:", e.error);
    recognition.start();
    speechRecognitionRef.current = recognition;
  };

  const stopSpeechRecognition = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
  };
  // Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "bot",
      text: "Hello! I am RailMadad AI, your automated assistant. How can I help you with your complaint today?",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [botReplyIndex, setBotReplyIndex] = useState(1);

  // Auto fetch location on mount
  useEffect(() => {
    fetchLocation();
    return () => {
      stopStreams();
      clearInterval(timerIntervalRef.current);
    };
  }, []);

  const stopStreams = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const fetchLocation = () => {
    setLocation((prev) => ({ ...prev, status: "fetching" }));
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude.toFixed(5),
            lng: position.coords.longitude.toFixed(5),
            status: "success",
            address: "GPS Auto-Captured",
          });
        },
        (error) => {
          setLocation({
            lat: "17.4334",
            lng: "78.5024",
            status: "success",
            address: "GPS Location Captured",
          });
        },
        { timeout: 5000, enableHighAccuracy: true },
      );
    } else {
      setLocation({
        lat: "17.4334",
        lng: "78.5024",
        status: "success",
        address: "GPS Location Captured",
      });
    }
  };

  // Image File Upload Handler
  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const photoData = event.target.result;
      setImage(photoData);
      setShowAiDetection(true);
      runImageToText(photoData);
    };
    reader.readAsDataURL(file);
  };

  // Audio File Upload Handler
  const handleAudioFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const audioData = event.target.result;
      setAudioUrl(audioData);
      setAiConverting((p) => ({ ...p, audio: true }));
      const transcript = await generateAudioTranscription(file);
      setAiConversions((p) => ({
        ...p,
        audioText: transcript || "Audio note uploaded by passenger.",
      }));
      setAiConverting((p) => ({ ...p, audio: false }));
    };
    reader.readAsDataURL(file);
  };

  // Video File Upload Handler
  const handleVideoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const videoData = event.target.result;
      setVideoUrl(videoData);
      setAiConverting((p) => ({ ...p, video: true }));
      const caption = await generateVideoCaption(file);
      setAiConversions((p) => ({ ...p, videoText: caption }));
      setAiConverting((p) => ({ ...p, video: false }));
    };
    reader.readAsDataURL(file);
  };

  // In-App Camera Trigger
  const startInAppCamera = async () => {
    stopStreams();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      mediaStreamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      alert(
        "Camera access unavailable or blocked. Please allow camera permissions.",
      );
    }
  };

  const capturePhotoFromCamera = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const photoData = canvas.toDataURL("image/jpeg");
      setImage(photoData);
      setShowAiDetection(true);
      stopStreams();
      setCameraActive(false);
      // Trigger frontend AI image-to-text
      runImageToText(photoData);
    }
  };

  // In-App Audio Recording + simultaneous SpeechRecognition
  const startAudioRecording = async () => {
    try {
      stopStreams();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      audioRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setAiConverting((p) => ({ ...p, audio: true }));
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        const localTranscript = speechTranscriptRef.current.trim();
        const apiTranscription = await generateAudioTranscription(audioBlob);

        setAiConversions((p) => ({
          ...p,
          audioText:
            apiTranscription ||
            localTranscript ||
            "Voice note recorded by passenger.",
        }));
        setAiConverting((p) => ({ ...p, audio: false }));
      };

      mediaRecorder.start(100);
      setIsRecordingAudio(true);
      setRecordingTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTimer((prev) => prev + 1);
      }, 1000);

      // Start speech recognition in parallel
      setAiConverting((p) => ({ ...p, audio: true }));
      setAiConversions((p) => ({ ...p, audioText: "" }));
      startSpeechRecognition();
    } catch (err) {
      alert("Microphone access blocked or unavailable.");
    }
  };

  const stopAudioRecording = () => {
    stopSpeechRecognition();
    if (
      audioRecorderRef.current &&
      audioRecorderRef.current.state !== "inactive"
    ) {
      audioRecorderRef.current.stop();
    }
    stopStreams();
    clearInterval(timerIntervalRef.current);
    setIsRecordingAudio(false);
  };

  // In-App Video Recording + simultaneous SpeechRecognition & ML Captioning
  const startVideoRecording = async () => {
    try {
      stopStreams();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      mediaStreamRef.current = stream;
      setVideoRecorderActive(true);

      setTimeout(() => {
        if (videoRecorderRef.current) {
          videoRecorderRef.current.srcObject = stream;
        }
      }, 100);

      videoChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
      });
      audioRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          // Assemble recorded chunks into a single Blob — exactly like upload file
          const videoBlob = new Blob(videoChunksRef.current, {
            type: "video/webm",
          });
          console.log(
            "[VideoRecord] Blob assembled, size:",
            videoBlob.size,
            "bytes",
          );

          const url = URL.createObjectURL(videoBlob);
          setVideoUrl(url);
          setVideoRecorderActive(false);
          setAiConverting((p) => ({ ...p, video: true }));
          setAiConversions((p) => ({ ...p, videoText: "" }));

          if (videoBlob.size < 500) {
            console.warn(
              "[VideoRecord] Blob too small, skipping AI captioning",
            );
            setAiConverting((p) => ({ ...p, video: false }));
            return;
          }

          // Read blob as base64 DataURL — same as FileReader in handleVideoFileUpload
          const videoBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(videoBlob);
          });
          console.log(
            "[VideoRecord] Base64 ready, length:",
            videoBase64?.length,
            "— calling /caption-video",
          );

          // Direct fetch to ML service — same as upload path
          const response = await fetch(`${ML_URL}/caption-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video: videoBase64 }),
            signal: AbortSignal.timeout(120000),
          });

          if (response.ok) {
            const data = await response.json();
            const caption = data.caption || data.text || "";
            console.log("[VideoRecord] Caption received:", caption);
            setAiConversions((p) => ({ ...p, videoText: caption }));
          } else {
            console.warn("[VideoRecord] Server error:", response.status);
          }
        } catch (err) {
          console.error("[VideoRecord] captioning failed:", err.message);
          const localTranscript = speechTranscriptRef.current.trim();
          if (localTranscript) {
            setAiConversions((p) => ({
              ...p,
              videoText: `Spoken: ${localTranscript}`,
            }));
          }
        } finally {
          setAiConverting((p) => ({ ...p, video: false }));
        }
      };

      mediaRecorder.start(100);
      setIsRecordingVideo(true);
      setRecordingTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTimer((prev) => prev + 1);
      }, 1000);

      // Start speech recognition in parallel
      setAiConverting((p) => ({ ...p, video: true }));
      setAiConversions((p) => ({ ...p, videoText: "" }));
      startSpeechRecognition();
    } catch (err) {
      alert("Camera/Microphone access blocked or unavailable.");
      setVideoRecorderActive(false);
    }
  };

  const stopVideoRecording = () => {
    stopSpeechRecognition();
    if (
      audioRecorderRef.current &&
      audioRecorderRef.current.state !== "inactive"
    ) {
      audioRecorderRef.current.stop();
    }
    stopStreams();
    clearInterval(timerIntervalRef.current);
    setIsRecordingVideo(false);
    setVideoRecorderActive(false);
  };

  const handleTrainSelect = (trainName) => {
    setTrainNumber(trainName);
    setShowTrainSuggest(false);
  };

  const handleCoachSelect = (coachName) => {
    setCoach(coachName);
    setShowCoachSuggest(false);
  };

  // Helper: convert a blob URL to base64 data URL
  const blobUrlToBase64 = (blobUrl) => {
    return new Promise((resolve, reject) => {
      fetch(blobUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
        .catch(reject);
    });
  };

  // Interactive Pre-Submission AI Assistant & Chatbot State
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiValidationStep, setAiValidationStep] = useState(null); // 'missing_info' | 'insufficient_info' | 'verification_failed'
  const [chatHistory, setChatHistory] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userReplyInput, setUserReplyInput] = useState("");
  const [userJourney, setUserJourney] = useState(null);
  const askedClarificationQuestionsRef = useRef([]);

  useEffect(() => {
    if (!user) return;

    const fetchUserJourney = async () => {
      try {
        const params = new URLSearchParams();
        if (user.phone) params.append("phone", user.phone);
        if (user.email) params.append("email", user.email);

        const res = await axiosClient.get(
          `/trains/active-journey?${params.toString()}`,
        );
        if (res.data?.hasActiveJourney) {
          setUserJourney(res.data);
        } else {
          setUserJourney(null);
        }
      } catch (err) {
        console.warn(
          "Unable to fetch active journey for clarification flow:",
          err.message,
        );
        setUserJourney(null);
      }
    };

    fetchUserJourney();
  }, [user]);

  const normalizeQuestionText = (question = "") =>
    String(question)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const buildSmartClarificationQuestions = (analysis = {}) => {
    const journeySeat = prefill?.berth || userJourney?.berth || "";
    const knownSeatText = journeySeat
      ? `I have your seat/berth as ${journeySeat}. `
      : "";

    const rawQuestions = [];
    const analysisQuestions = Array.isArray(analysis.missing_questions)
      ? analysis.missing_questions.filter(
          (q) => typeof q === "string" && q.trim(),
        )
      : [];

    rawQuestions.push(...analysisQuestions);

    if (!rawQuestions.some((q) => /berth|seat|coach|location/i.test(q))) {
      rawQuestions.push(
        "What exactly is wrong with your coach or seat area today?",
      );
    }

    if (
      !rawQuestions.some((q) =>
        /when|started|since|time|duration|ongoing/i.test(q),
      )
    ) {
      rawQuestions.push("When did this start, and is it ongoing?");
    }

    if (
      !rawQuestions.some((q) =>
        /affect|impact|how many|people|passenger|section/i.test(q),
      )
    ) {
      rawQuestions.push(
        "Is it affecting just your area or multiple passengers?",
      );
    }

    const deduped = [];
    const seen = new Set(askedClarificationQuestionsRef.current);

    rawQuestions.forEach((question) => {
      const clean = normalizeQuestionText(question);
      if (!clean || clean.length < 12 || seen.has(clean)) return;
      seen.add(clean);
      deduped.push(question.trim());
    });

    const finalQuestions = deduped
      .filter((question) => !/berth|seat/i.test(question) || !journeySeat)
      .slice(0, 2)
      .map((question) => `${knownSeatText}${question}`.trim());

    return finalQuestions.length
      ? finalQuestions
      : [
          `${knownSeatText}What exactly is wrong with your coach or seat area today?`,
          "When did this start, and is it ongoing?",
        ];
  };

  // Pre-submission AI check logic (Runs Nemotron Analysis first, then validates signals)
  const validateAndSubmitComplaint = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`${ML_URL}/analyze-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: description,
          image: image ? aiConversions.imageText : "",
          audio: audioUrl ? aiConversions.audioText : "",
          video: videoUrl ? aiConversions.videoText : "",
          trainNumber,
          coach,
          pnr,
        }),
      });

      if (response.ok) {
        const analysis = await response.json();
        setLlmAnalysis(analysis);

        // Step A: Pre-check with Verification Agent if image is present
        if (image) {
          try {
            const vRes = await fetch(`${ML_URL}/verify-evidence`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image,
                trainNumber: trainNumber?.trim() || "UNKNOWN",
                coach: coach?.trim() || "UNKNOWN",
              }),
            });
            if (vRes.ok) {
              const vData = await vRes.json();
              console.log(
                "🔍 [FRONTEND PRE-CHECK] Verification Agent Output:",
                vData,
              );
              if (
                vData.verification_status === "FLAGGED" ||
                vData.human_review_required
              ) {
                setAiValidationStep("verification_failed");
                const initialMsg =
                  `🚨 Evidence Verification Alert:\n` +
                  `Cross-checking photo EXIF & coach OCR against live train data flagged a potential mismatch.\n` +
                  `Note: ${vData.reasons?.[0] || "Location or coach mismatch detected."}\n\n` +
                  `Please specify what part of your journey details or photo might need clarification.`;
                setChatHistory([{ sender: "ai", text: initialMsg }]);
                setPendingQuestions([]);
                setCurrentQuestionIndex(0);
                setAiAssistantOpen(true);
                setSubmitting(false);
                return;
              }
            }
          } catch (vErr) {
            console.warn(
              "Frontend verification pre-check notice:",
              vErr.message,
            );
          }
        }

        // Step B: build a small conversational clarification flow, deduplicated and based on the user's actual journey data.
        const smartQuestions = buildSmartClarificationQuestions(analysis);
        const miStr = String(analysis.missing_info || "").toLowerCase();
        const hasMissingInfo =
          miStr &&
          !miStr.includes("none") &&
          !miStr.includes("all provided") &&
          !miStr.includes("complete");

        let questionsToAsk = smartQuestions;
        if (hasMissingInfo && questionsToAsk.length === 0) {
          questionsToAsk = [`Could you clarify: ${analysis.missing_info}?`];
        }

        if (questionsToAsk.length > 0) {
          const normalizedQuestions = questionsToAsk
            .map((q) => normalizeQuestionText(q))
            .filter(Boolean);
          const finalQuestions = questionsToAsk
            .filter((q, idx) => {
              const normalized = normalizedQuestions[idx];
              return (
                normalized &&
                !askedClarificationQuestionsRef.current.includes(normalized)
              );
            })
            .slice(0, 2);

          if (finalQuestions.length === 0) {
            executeComplaintSubmission(analysis, false);
            return;
          }

          askedClarificationQuestionsRef.current = [
            ...new Set([
              ...askedClarificationQuestionsRef.current,
              ...finalQuestions
                .map((q) => normalizeQuestionText(q))
                .filter(Boolean),
            ]),
          ];

          setAiValidationStep("missing_info");
          setPendingQuestions(finalQuestions);
          setCurrentQuestionIndex(0);

          const introText =
            prefill?.berth || userJourney?.berth
              ? `I've already noted your seat/berth as ${prefill?.berth || userJourney?.berth}. I just need 2 quick details so we can route this without delay.`
              : "I just need 2 quick details so we can route this without delay.";

          setChatHistory([
            {
              sender: "ai",
              text: `👋 ${introText}\n\n❓ ${finalQuestions[0]}`,
            },
          ]);
          setAiAssistantOpen(true);
          setSubmitting(false);
          return;
        }

        // All checks passed -> Submit final complaint
        executeComplaintSubmission(analysis, false);
      } else {
        // Fallback submit if endpoint error
        executeComplaintSubmission(null, false);
      }
    } catch (err) {
      console.warn("Pre-submission AI validation notice:", err.message);
      executeComplaintSubmission(null, false);
    }
  };

  const handleAiAssistantReply = (e) => {
    e.preventDefault();
    const replyText = userReplyInput.trim();
    if (!replyText) return;

    const askedQuestion = pendingQuestions[currentQuestionIndex];
    if (askedQuestion) {
      askedClarificationQuestionsRef.current = [
        ...new Set([
          ...askedClarificationQuestionsRef.current,
          normalizeQuestionText(askedQuestion),
        ]),
      ];
    }

    const updatedHistory = [
      ...chatHistory,
      { sender: "user", text: replyText },
    ];
    setChatHistory(updatedHistory);
    setUserReplyInput("");

    const updatedDesc = description
      ? `${description}\n\n[Passenger Clarification]: ${replyText}`
      : replyText;
    setDescription(updatedDesc);

    const nextIdx = currentQuestionIndex + 1;
    if (pendingQuestions.length > 0 && nextIdx < pendingQuestions.length) {
      setCurrentQuestionIndex(nextIdx);
      setTimeout(() => {
        const nextQuestion = pendingQuestions[nextIdx];
        const nextQuestionKey = normalizeQuestionText(nextQuestion);
        if (askedClarificationQuestionsRef.current.includes(nextQuestionKey)) {
          setAiAssistantOpen(false);
          setAiValidationStep(null);
          validateAndSubmitComplaint();
          return;
        }

        setChatHistory((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Thanks — one final detail: \n\n❓ ${nextQuestion}`,
          },
        ]);
      }, 400);
    } else {
      setTimeout(() => {
        setChatHistory((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Perfect — I’ve got the key details. Re-checking your complaint and finalizing it now...`,
          },
        ]);
        setTimeout(() => {
          setAiAssistantOpen(false);
          setAiValidationStep(null);
          validateAndSubmitComplaint();
        }, 900);
      }, 400);
    }
  };

  const handleForceManualReview = () => {
    setAiAssistantOpen(false);
    setAiValidationStep(null);
    // Submit with flag indicating forced manual review
    executeComplaintSubmission(llmAnalysis, true);
  };

  const executeComplaintSubmission = async (
    currentLlmAnalysis = null,
    forceManualReview = false,
  ) => {
    setSubmitting(true);
    try {
      // Safeguard against event object being passed when called directly by onClick
      const isEvent =
        currentLlmAnalysis &&
        (currentLlmAnalysis instanceof Event ||
          typeof currentLlmAnalysis.preventDefault === "function" ||
          currentLlmAnalysis.nativeEvent);
      const sanitizedAnalysis = isEvent ? null : currentLlmAnalysis;

      // Mark analysis as needing manual officer review ONLY when the passenger
      // explicitly chose it — insufficient details are handled by the backend
      // follow-up questions flow, never forced manual review.
      const finalAnalysis = sanitizedAnalysis
        ? {
            ...sanitizedAnalysis,
            requires_manual_officer_review: forceManualReview === true,
          }
        : null;

      const payload = {
        trainNumber,
        coach,
        pnr,
        description,
        image, // base64
        audio: audioUrl,
        video: videoUrl,
        location,
        passengerName: user?.name,
        passengerPhone: user?.phone,
        aiConversions: {
          imageText: aiConversions.imageText,
          audioText: aiConversions.audioText,
          videoText: aiConversions.videoText,
        },
        llmAnalysis: finalAnalysis || llmAnalysis || null,
      };

      const res = await axiosClient.post("/complaints", payload);
      const savedComplaint = res.data.complaint;
      setSubmittedComplaint(savedComplaint);
      navigate("/track", {
        state: {
          complaintId: savedComplaint.complaintId || savedComplaint._id,
        },
      });
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to submit complaint. Please check your backend connection.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(pnr.trim())) {
      alert("PNR must be exactly 10 digits (numbers only).");
      return;
    }
    if (!image && !audioUrl && !videoUrl && !description.trim()) {
      alert(
        "Please provide at least one input (Photo, Audio, Video, or Text description).",
      );
      return;
    }
    if (image && flowStep === 1) {
      setFlowStep(2);
      return;
    }
    // Initiate AI validation check before submitting
    validateAndSubmitComplaint();
  };

  const handleSendChat = (text) => {
    if (!text.trim()) return;
    const newMessages = [...chatMessages, { sender: "user", text }];
    setChatMessages(newMessages);
    setInputMessage("");

    setTimeout(() => {
      const reply =
        MOCK_BOT_RESPONSES[botReplyIndex % MOCK_BOT_RESPONSES.length];
      setChatMessages((prev) => [...prev, { sender: "bot", text: reply }]);
      setBotReplyIndex((prev) => prev + 1);
    }, 800);
  };

  return (
    <div className="flex flex-col flex-1 pb-16 relative">
      {/* Top Navigation */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center justify-between sticky top-0 z-20">
        <button
          onClick={() => {
            if (flowStep === 3) setFlowStep(1);
            else if (flowStep === 2) setFlowStep(1);
            else navigate("/");
          }}
          className="p-1.5 hover:bg-slate-50 rounded-full transition text-slate-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2">
          <img
            src="/logo.png"
            alt="Rail Madad Logo"
            className="w-6 h-6 object-contain"
          />
          <h1 className="text-base font-bold text-slate-800">
            {flowStep === 1 && "Capture & Report"}
            {flowStep === 2 && "Photo Quality"}
            {flowStep === 3 && "Report Status"}
          </h1>
        </div>
        <button className="p-1.5 hover:bg-slate-50 rounded-full transition text-slate-600">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Step Indicator */}
      {flowStep < 3 && (
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                flowStep >= 1
                  ? "bg-primary text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              1
            </span>
            <span className="text-xs font-semibold text-slate-700">
              Capture
            </span>
          </div>
          <div className="h-[2px] flex-1 bg-slate-200 mx-3"></div>
          <div className="flex items-center space-x-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                flowStep === 2
                  ? "bg-primary text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              2
            </span>
            <span className="text-xs font-semibold text-slate-600">
              Details
            </span>
          </div>
          <div className="h-[2px] flex-1 bg-slate-200 mx-3"></div>
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-slate-200 text-slate-500">
              3
            </span>
            <span className="text-xs font-semibold text-slate-500">Submit</span>
          </div>
        </div>
      )}

      {/* Screen 1: Capture & Details */}
      {flowStep === 1 && (
        <form onSubmit={handleSubmit} className="flex-1 p-5 space-y-6">
          {/* Multi-Modal Tabs Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("photo")}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                  activeTab === "photo"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Photo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audio")}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                  activeTab === "audio"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>Voice</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("video")}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                  activeTab === "video"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Video</span>
              </button>
            </div>
          </div>

          {/* Tab Content: Photo Capture */}
          {activeTab === "photo" && (
            <div className="space-y-3">
              {cameraActive ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex flex-col items-center justify-center border border-slate-300 shadow-md">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 flex items-center space-x-4 z-10">
                    <button
                      type="button"
                      onClick={capturePhotoFromCamera}
                      className="p-4 bg-red-600 text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition"
                    >
                      <Camera className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraActive(false);
                        stopStreams();
                      }}
                      className="p-3 bg-slate-800/80 text-white rounded-full text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {image && (
                    <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-200 shadow-sm group">
                      <img
                        src={image}
                        alt="Selected Issue"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setImage(null);
                            setShowAiDetection(false);
                          }}
                          className="p-1.5 bg-red-600 text-white rounded-full shadow hover:bg-red-700 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={startInAppCamera}
                      className="border-2 border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-blue-50/30 transition rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-2 group cursor-pointer"
                    >
                      <div className="p-2.5 bg-white rounded-full shadow-sm text-primary group-hover:scale-110 transition-transform">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Take Live Photo
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Direct Camera
                        </p>
                      </div>
                    </button>

                    <label className="border-2 border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-blue-50/30 transition rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-2 group cursor-pointer relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                      <div className="p-2.5 bg-white rounded-full shadow-sm text-primary group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Upload Image File
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Choose from gallery
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Audio Capture */}
          {activeTab === "audio" && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mic className="w-5 h-5 text-primary" />
                  <span className="text-xs font-bold text-slate-800">
                    In-App Voice Recorder
                  </span>
                </div>
                {isRecordingAudio && (
                  <span className="text-xs font-extrabold text-red-600 flex items-center animate-pulse">
                    <span className="w-2 h-2 bg-red-600 rounded-full mr-1.5"></span>
                    Recording ({recordingTimer}s)
                  </span>
                )}
              </div>

              {audioUrl ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-50 text-primary rounded-lg">
                        <Volume2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Live Voice Note Recorded
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Captured via in-app mic
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAudioUrl(null)}
                      className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <audio controls src={audioUrl} className="w-full h-8" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3 py-3">
                  <div className="flex items-center space-x-3">
                    {!isRecordingAudio ? (
                      <button
                        type="button"
                        onClick={startAudioRecording}
                        className="px-5 py-3 bg-primary hover:bg-blue-800 text-white rounded-xl font-bold text-xs flex items-center space-x-2 shadow-md transition"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Start Voice Recording</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopAudioRecording}
                        className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center space-x-2 shadow-md transition"
                      >
                        <Square className="w-4 h-4" />
                        <span>Stop & Save Recording</span>
                      </button>
                    )}

                    <label className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-sm transition cursor-pointer">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioFileUpload}
                        className="hidden"
                      />
                      <Upload className="w-4 h-4 text-primary" />
                      <span>Upload Audio File</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400 text-center">
                    Record live voice or upload an audio file from device.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Video Capture */}
          {activeTab === "video" && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="w-5 h-5 text-primary" />
                  <span className="text-xs font-bold text-slate-800">
                    In-App Video Recorder
                  </span>
                </div>
                {isRecordingVideo && (
                  <span className="text-xs font-extrabold text-red-600 flex items-center animate-pulse">
                    <span className="w-2 h-2 bg-red-600 rounded-full mr-1.5"></span>
                    REC ({recordingTimer}s)
                  </span>
                )}
              </div>

              {videoRecorderActive ? (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex flex-col items-center justify-center">
                  <video
                    ref={videoRecorderRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={stopVideoRecording}
                    className="absolute bottom-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg shadow"
                  >
                    Stop Recording
                  </button>
                </div>
              ) : videoUrl ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-50 text-primary rounded-lg">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Live Video Recorded
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Captured via in-app camera
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVideoUrl(null)}
                      className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <video
                    controls
                    src={videoUrl}
                    className="w-full rounded-lg aspect-video object-cover"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3 py-3">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={startVideoRecording}
                      className="px-5 py-3 bg-primary hover:bg-blue-800 text-white rounded-xl font-bold text-xs flex items-center space-x-2 shadow-md transition"
                    >
                      <Video className="w-4 h-4" />
                      <span>Record Video In-App</span>
                    </button>

                    <label className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-sm transition cursor-pointer">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileUpload}
                        className="hidden"
                      />
                      <Upload className="w-4 h-4 text-primary" />
                      <span>Upload Video File</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400 text-center">
                    Record live video clip or upload a video file from device.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Selected Media Mix Badges Summary */}
          {(image || audioUrl || videoUrl) && (
            <div className="bg-slate-100/70 rounded-xl p-3 flex items-center flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-500 mr-1">
                Attached Media:
              </span>
              {image && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                  <Camera className="w-3 h-3 mr-1 text-primary" /> Photo
                  Attached
                </span>
              )}
              {audioUrl && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                  <Mic className="w-3 h-3 mr-1 text-primary" /> Voice Note
                  Attached
                </span>
              )}
              {videoUrl && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                  <Video className="w-3 h-3 mr-1 text-primary" /> Video Clip
                  Attached
                </span>
              )}
            </div>
          )}

          {/* Geolocation Auto-Capture Section */}
          <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-primary font-bold text-xs uppercase tracking-wide">
                <MapPin className="w-4 h-4" />
                <span>User Location</span>
              </div>
              <button
                type="button"
                onClick={fetchLocation}
                className="text-[10px] font-bold text-primary hover:underline flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="bg-white border border-blue-100 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between items-center text-slate-700 font-semibold">
                <span>
                  Latitude:{" "}
                  <span className="font-extrabold text-slate-900">
                    {location.lat || "17.4334"}
                  </span>
                </span>
                <span>
                  Longitude:{" "}
                  <span className="font-extrabold text-slate-900">
                    {location.lng || "78.5024"}
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {location.address}
              </p>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Train & Journey Details
            </h3>

            {/* Train Number Input with Autosuggest */}
            <div className="relative">
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Train Number / Name *
              </label>
              <input
                type="text"
                value={trainNumber}
                onChange={(e) => {
                  setTrainNumber(e.target.value);
                  setShowTrainSuggest(true);
                }}
                onFocus={() => setShowTrainSuggest(true)}
                placeholder="Enter Train Number (e.g. 12951)"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary font-medium text-sm transition"
                required
              />
              {showTrainSuggest && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-30 max-h-40 overflow-y-auto">
                  {REAL_TRAINS.filter((t) =>
                    t.name.toLowerCase().includes(trainNumber.toLowerCase()),
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTrainSelect(t.name)}
                      className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-50 border-b border-slate-50 last:border-0 text-slate-700 flex justify-between items-center"
                    >
                      <span>{t.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Coach Input */}
            <div className="relative">
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Coach Number *
              </label>
              <input
                type="text"
                value={coach}
                onChange={(e) => {
                  setCoach(e.target.value);
                  setShowCoachSuggest(true);
                }}
                onFocus={() => setShowCoachSuggest(true)}
                placeholder="Enter Coach (e.g. B4)"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary font-medium text-sm transition"
                required
              />
              {showCoachSuggest && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-30 max-h-40 overflow-y-auto">
                  {MOCK_COACHES.filter((c) =>
                    c.name.toLowerCase().includes(coach.toLowerCase()),
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCoachSelect(c.id)}
                      className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-50 border-b border-slate-50 last:border-0 text-slate-700 flex justify-between items-center"
                    >
                      <span>{c.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PNR Input */}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                PNR Number *
              </label>
              <input
                type="text"
                value={pnr}
                onChange={(e) =>
                  setPnr(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="Enter 10-digit PNR"
                inputMode="numeric"
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary font-medium text-sm transition"
                required
              />
            </div>

            {/* Description Textarea */}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Issue Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue in detail..."
                rows="3"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary font-medium text-sm transition resize-none"
              ></textarea>
            </div>
          </div>

          {/* Clean Responsive LLM Analysis Card Display */}
          {llmAnalysis && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-50 text-primary rounded-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      AI Complaint Triage Analysis
                    </h3>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${
                    String(llmAnalysis.urgency || "")
                      .toLowerCase()
                      .includes("critical") ||
                    String(llmAnalysis.urgency || "")
                      .toLowerCase()
                      .includes("high")
                      ? "bg-red-50 text-red-700 border-red-200"
                      : String(llmAnalysis.urgency || "")
                            .toLowerCase()
                            .includes("low")
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {llmAnalysis.urgency || "Medium"}
                </span>
              </div>

              {/* Key-Value Pairs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* 1. input coherence */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                    Input Coherence (are_texts_related)
                  </span>
                  <p className="text-slate-800 font-semibold leading-relaxed">
                    {llmAnalysis.are_texts_related ||
                      "All input modalities describe a consistent issue."}
                  </p>
                </div>

                {/* 2. missing info status */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                    Missing Details (missing_info)
                  </span>
                  <p
                    className={`font-semibold leading-relaxed ${
                      String(llmAnalysis.missing_info || "")
                        .toLowerCase()
                        .includes("none") ||
                      String(llmAnalysis.missing_info || "")
                        .toLowerCase()
                        .includes("complete")
                        ? "text-green-700"
                        : "text-amber-700"
                    }`}
                  >
                    {llmAnalysis.missing_info ||
                      "None - All mandatory details provided"}
                  </p>
                </div>

                {/* 3. is_sufficient status */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                    Context Sufficiency (is_sufficient)
                  </span>
                  <p
                    className={`font-semibold leading-relaxed ${
                      llmAnalysis.is_sufficient !== false
                        ? "text-green-700"
                        : "text-red-600 font-bold"
                    }`}
                  >
                    {llmAnalysis.is_sufficient !== false
                      ? "✅ Sufficient Context Provided"
                      : "⚠️ Insufficient / Vague Details (Flagged for Review)"}
                  </p>
                </div>

                {/* 4. decision reasoning */}
                {llmAnalysis.decision_reasoning && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 md:col-span-2">
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                      AI Decision Reasoning
                    </span>
                    <p className="text-slate-700 font-medium leading-relaxed">
                      {llmAnalysis.decision_reasoning}
                    </p>
                  </div>
                )}

                {/* 4. keywords */}
                {Array.isArray(llmAnalysis.keywords) &&
                  llmAnalysis.keywords.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 md:col-span-2">
                      <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                        Extracted Keywords
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {llmAnalysis.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-700 shadow-2xs"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* 5. summary breakdown */}
                {llmAnalysis.summary && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 md:col-span-2">
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                      Structured Summary
                    </span>
                    {typeof llmAnalysis.summary === "string" ? (
                      <p className="text-slate-700 font-medium leading-relaxed">
                        {llmAnalysis.summary}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.entries(llmAnalysis.summary).map(
                          ([k, v], idx) => (
                            <div
                              key={idx}
                              className="bg-white p-2 rounded-lg border border-slate-200 text-[11px]"
                            >
                              <span className="font-bold text-primary mr-1">
                                {k}:
                              </span>
                              <span className="text-slate-700 font-medium">
                                {typeof v === "object"
                                  ? JSON.stringify(v)
                                  : String(v)}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. action steps */}
                {Array.isArray(llmAnalysis.action_steps) &&
                  llmAnalysis.action_steps.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 md:col-span-2">
                      <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                        Recommended Action Steps
                      </span>
                      <ul className="space-y-1 pl-1">
                        {llmAnalysis.action_steps.map((step, i) => (
                          <li
                            key={i}
                            className="flex items-start space-x-2 text-slate-700 text-xs font-medium"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Submit Button (Disabled while AI media-to-text processing is active) */}
          {aiConverting.image || aiConverting.audio || aiConverting.video ? (
            <div className="space-y-2">
              <button
                type="button"
                disabled
                className="w-full py-4 bg-slate-300 text-slate-600 rounded-xl font-bold flex items-center justify-center space-x-2 cursor-not-allowed shadow-inner"
              >
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span>
                  Processing attached media (
                  {aiConverting.image
                    ? "Photo"
                    : aiConverting.audio
                      ? "Audio"
                      : "Video"}
                  )...
                </span>
              </button>
              <p className="text-[11px] text-amber-600 text-center font-bold animate-pulse">
                ⏳ Please wait.
              </p>
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-primary hover:bg-blue-800 text-white rounded-xl font-bold transition shadow-lg shadow-blue-800/10 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Report</span>
              )}
            </button>
          )}
        </form>
      )}

      {/* Interactive Pre-Submission AI Assistant Live Chat Modal */}
      {aiAssistantOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end md:justify-center items-center p-0 md:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-lg h-[520px] max-h-[90vh] flex flex-col shadow-2xl animate-slide-up relative border border-slate-200 overflow-hidden">
            {/* Live Chat Header */}
            <div className="bg-primary text-white px-5 py-3.5 flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-wide">
                    RailMadad AI
                  </h3>

                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiAssistantOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Conversation Stream (Chat Bubbles) */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {chatHistory.map((msg, idx) =>
                msg.sender === "ai" ? (
                  <div
                    key={idx}
                    className="flex items-start space-x-2.5 max-w-[88%] animate-slide-up"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow">
                      AI
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-3.5 shadow-xs space-y-1">
                      <div className="flex items-center space-x-1 text-primary font-bold text-[10px] uppercase tracking-wider">
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        <span>AI Assistant Question</span>
                      </div>
                      <p className="text-xs text-slate-800 font-semibold whitespace-pre-line leading-relaxed">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    key={idx}
                    className="flex items-start justify-end space-x-2.5 animate-slide-up"
                  >
                    <div className="bg-primary text-white rounded-2xl rounded-tr-xs p-3 text-xs font-medium shadow-xs max-w-[80%] whitespace-pre-line">
                      {msg.text}
                    </div>
                  </div>
                ),
              )}
            </div>

            {/* Chatbot Bottom Action Area */}
            <div className="p-3.5 bg-white border-t border-slate-100 space-y-2.5">
              <form
                onSubmit={handleAiAssistantReply}
                className="flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={userReplyInput}
                  onChange={(e) => setUserReplyInput(e.target.value)}
                  placeholder="Answer the AI questions above (e.g. Berth 42, pipe leak)..."
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-xs font-medium bg-slate-50 focus:bg-white"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-3 bg-primary hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-md shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>

              <div className="flex items-center justify-between text-[11px] pt-1">
                {(aiValidationStep === "insufficient_info" ||
                  aiValidationStep === "verification_failed") && (
                  <button
                    type="button"
                    onClick={handleForceManualReview}
                    className="text-amber-800 hover:text-amber-900 font-bold flex items-center space-x-1 underline"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Proceed to Manual Officer Review</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setAiAssistantOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-medium ml-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: Photo Quality Check */}
      {flowStep === 2 && (
        <div className="flex-1 p-5 space-y-6">
          {/* Photo Preview Container */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-md aspect-video relative">
            <img
              src={image}
              alt="Uploaded issue"
              className="w-full h-full object-cover filter brightness-[0.6]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-black/60 flex items-center justify-between p-4">
              <span className="text-white text-xs font-semibold">
                Current Photo
              </span>
            </div>
          </div>

          {/* Quality Warning Card */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center space-x-2.5 text-amber-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h3 className="font-bold text-sm">
                Photo's a bit dark — want to retake it?
              </h3>
            </div>
            <p className="text-xs text-amber-600 leading-relaxed pl-7">
              A clearer photo helps our AI routing system classify the severity
              and assign a technician immediately.
            </p>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              onClick={() => {
                setImage(null);
                setShowAiDetection(false);
                setFlowStep(1);
              }}
              className="py-3.5 border border-slate-300 text-slate-700 hover:bg-slate-50 transition rounded-xl font-bold text-sm"
            >
              Retake
            </button>
            <button
              onClick={() => executeComplaintSubmission(null, false)}
              disabled={submitting}
              className="py-3.5 bg-primary text-white hover:bg-blue-800 transition rounded-xl font-bold text-sm disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Continue & Submit"}
            </button>
          </div>
        </div>
      )}

      {flowStep === 3 && (
        <div className="flex-1 p-5 space-y-4">
          {/* Specific Success Alert Banner */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center space-x-3 text-green-800 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-xs font-bold font-sans">
              Report submitted —{" "}
              {submittedComplaint?.complaintId || "RMDA Success"}
            </span>
          </div>

          {/* Status Header */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                Report ID
              </span>
              <p className="text-base font-extrabold text-slate-800 tracking-wide">
                {submittedComplaint?.complaintId || "RMDA Status"}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
              {submittedComplaint?.status || "Submitted"}
            </span>
          </div>

          {/* Vertical Timeline */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Tracking Progress
            </h3>

            <div className="space-y-6 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
              {getTimelineSteps().map((step, index) => {
                const currentStatus = submittedComplaint?.status || "Submitted";
                const isCurrent =
                  String(step.status).toLowerCase() ===
                  String(currentStatus).toLowerCase();
                const isCompleted =
                  Boolean(step.completed) ||
                  index < getStatusIndex(currentStatus);

                return (
                  <div key={`${step.status}-${index}`} className="relative">
                    <div
                      className={`absolute -left-[21px] top-0.5 rounded-full p-0.5 shadow-sm ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                            ? "bg-blue-500 text-white ring-4 ring-blue-100 animate-pulse"
                            : "bg-white border-2 border-slate-200 text-slate-300"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <div className="w-2.5 h-2.5 bg-current rounded-full" />
                      )}
                    </div>
                    <div>
                      <h4
                        className={`text-sm font-bold ${isCurrent ? "text-blue-800" : isCompleted ? "text-slate-800" : "text-slate-300"}`}
                      >
                        {step.status}
                      </h4>
                      <p
                        className={`text-[11px] font-medium ${isCurrent ? "text-blue-600" : isCompleted ? "text-slate-400" : "text-slate-300"}`}
                      >
                        {step.time ||
                          (isCurrent
                            ? "In progress now"
                            : isCompleted
                              ? "Completed"
                              : "Pending")}
                      </p>
                      {isCurrent && step.status === "Routed to Department" && (
                        <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                          Assigned to Railway Division Operations Team.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grouped Status Card */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm shadow-green-200/10">
            <div className="p-3 bg-green-500 text-white rounded-xl shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">Report Active</p>
              <p className="text-xs text-green-600 font-medium mt-0.5">
                Assigned for Train {trainNumber || "Selected Train"} (Coach{" "}
                {coach || "N/A"})
              </p>
            </div>
          </div>

          {/* Chat CTA Button */}
          <button
            onClick={() => setChatOpen(true)}
            className="w-full py-4 bg-primary hover:bg-blue-800 text-white rounded-2xl font-bold flex items-center justify-center space-x-2.5 shadow-xl shadow-blue-800/20 active:scale-[0.98] transition"
          >
            <MessageSquare className="w-5 h-5" />
            <span>Ask RailMadad AI</span>
          </button>
        </div>
      )}

      {/* Chatbot Modal */}
      {chatOpen && (
        <div className="absolute inset-0 bg-black/50 z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-[2rem] h-[80%] flex flex-col shadow-2xl relative animate-slide-up border-t border-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-[2rem]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-primary text-white rounded-xl shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    RailMadad AI
                  </h3>
                  <p className="text-[10px] text-green-500 font-bold flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-ping"></span>
                    Online Assistant
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-2 hover:bg-slate-200/50 rounded-full transition text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-3 rounded-2xl text-xs font-medium leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-primary text-white rounded-br-none shadow-md shadow-blue-800/10"
                        : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/50"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Suggestions / Canned inputs */}
            <div className="px-5 py-2 border-t border-slate-50 flex gap-2 overflow-x-auto no-scrollbar bg-slate-50/50">
              <button
                onClick={() =>
                  handleSendChat(
                    "When will this cleanliness issue be resolved?",
                  )
                }
                className="flex-shrink-0 px-3 py-1.5 bg-white border border-slate-200 hover:border-primary text-slate-600 hover:text-primary transition rounded-full text-[11px] font-semibold"
              >
                When resolved?
              </button>
              <button
                onClick={() => handleSendChat("Is a cleaner already assigned?")}
                className="flex-shrink-0 px-3 py-1.5 bg-white border border-slate-200 hover:border-primary text-slate-600 hover:text-primary transition rounded-full text-[11px] font-semibold"
              >
                Is cleaner assigned?
              </button>
              <button
                onClick={() => handleSendChat("How do I escalate this?")}
                className="flex-shrink-0 px-3 py-1.5 bg-white border border-slate-200 hover:border-primary text-slate-600 hover:text-primary transition rounded-full text-[11px] font-semibold"
              >
                How to escalate?
              </button>
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-slate-100 flex items-center space-x-3 bg-white pb-6">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSendChat(inputMessage)
                }
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary font-medium text-xs bg-slate-50/50"
              />
              <button
                onClick={() => handleSendChat(inputMessage)}
                className="p-3 bg-primary hover:bg-blue-800 text-white rounded-xl shadow-md transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
