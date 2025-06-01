// src/App.jsx

import { useState, useRef, useEffect } from 'react';

function App() {
  // ─── Authentication State ───────────────────────────────────────────────────
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  // ─── Conversation State ─────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [currentConvTitle, setCurrentConvTitle] = useState("");

  // ─── Chat State ─────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

  // ─── Search & Summaries State ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [fileName, setFileName] = useState(null);
  const [summary, setSummary] = useState("");
  const [format, setFormat] = useState("bullet");
  const [structSummary, setStructSummary] = useState("");
  const [analysisResults, setAnalysisResults] = useState(null);

  // ─── Scroll chat into view ────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── When token changes (login/logout) → fetch conversations  ─────────────────
  useEffect(() => {
    if (!token) {
      setConversations([]);
      setCurrentConvId(null);
      setCurrentConvTitle("");
      setMessages([]);
      return;
    }

    // Fetch all conversations for this user
    fetch("http://localhost:8000/conversations/", {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch conversations");
        return res.json();
      })
      .then((data) => {
        setConversations(data);

        // If there’s at least one conversation, load the most recent:
        if (data.length > 0) {
          const latest = data[0];
          setCurrentConvId(latest.id);
          setCurrentConvTitle(latest.title);
        }
      })
      .catch(() => {
        console.error("Could not load conversations");
      });
  }, [token]);

  // ─── When currentConvId changes → fetch that conversation’s messages ──────────
  useEffect(() => {
    if (!token || !currentConvId) {
      setMessages([]);
      return;
    }

    fetch(`http://localhost:8000/chat/${currentConvId}`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch chat history");
        return res.json();
      })
      .then((data) => {
        // data.messages is an array of { id, role, text, timestamp }
        const loaded = data.messages.map((m) => ({
          sender: m.role === "user" ? "user" : "bot",
          text: m.text,
          timestamp: new Date(m.timestamp).toLocaleTimeString(),
        }));
        setMessages(loaded);
      })
      .catch(() => {
        console.error("Could not load chat history for conversation");
      });
  }, [currentConvId, token]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  // 1) Create a new conversation
  const createNewConversation = async () => {
    if (!token) {
      alert("Please log in first.");
      return;
    }
    try {
      const res = await fetch("http://localhost:8000/conversations/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const newConv = await res.json();
      // Prepend to conversations list:
      setConversations((prev) => [newConv, ...prev]);
      // Switch into it:
      setCurrentConvId(newConv.id);
      setCurrentConvTitle(newConv.title);
      setMessages([]); // start with an empty chat window
    } catch (err) {
      alert("Could not create conversation: " + err.message);
    }
  };

  // 2) Select an existing conversation
  const selectConversation = (conv) => {
    setCurrentConvId(conv.id);
    setCurrentConvTitle(conv.title);
  };

  // 3) Delete a conversation
  const deleteConversation = async (convId) => {
    if (!token) {
      alert("Please log in first.");
      return;
    }
    const confirm = window.confirm("Delete this conversation? This cannot be undone.");
    if (!confirm) return;

    try {
      const res = await fetch(`http://localhost:8000/conversations/${convId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
      if (res.status !== 204) throw new Error("Failed to delete conversation");

      // Remove from conversation list
      setConversations((prev) => prev.filter((c) => c.id !== convId));

      // If the deleted conversation was currently selected, pick another
      if (currentConvId === convId) {
        if (conversations.length > 1) {
          // find next available conversation
          const nextConv = conversations.find((c) => c.id !== convId);
          setCurrentConvId(nextConv ? nextConv.id : null);
          setCurrentConvTitle(nextConv ? nextConv.title : "");
        } else {
          // no conversations left
          setCurrentConvId(null);
          setCurrentConvTitle("");
          setMessages([]);
        }
      }
    } catch (err) {
      alert("Could not delete conversation: " + err.message);
    }
  };

  // 4) sendMessage → POST /chat/{currentConvId}/ask
  const sendMessage = async () => {
    if (!input.trim() || !currentConvId) return;
    if (!token) {
      alert("Please login first.");
      return;
    }

    const userEntry = {
      sender: 'user',
      text: input,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((m) => [...m, userEntry]);

    // Build payload: send the entire chat history plus this new user message
    const payloadMsgs = [
      { role: 'system', content: 'You are a helpful assistant that remembers context.' },
      ...messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: input },
    ];

    setInput("");

    try {
      const res = await fetch(`http://localhost:8000/chat/${currentConvId}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: payloadMsgs }),
      });
      if (!res.ok) throw new Error("Chat API failed");
      const botData = await res.json();
      const answer = botData.text; // router returns { id, role, text, timestamp }
      setMessages((m) => [
        ...m,
        { sender: 'bot', text: answer, timestamp: new Date().toLocaleTimeString() },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { sender: 'bot', text: '❌ Failed to fetch answer', timestamp: new Date().toLocaleTimeString() },
      ]);
    }
  };

  // 5) handleSearch (UNCHANGED)
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `http://localhost:8000/search?q=${encodeURIComponent(searchQuery)}`
      );
      const { results } = await res.json();
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  // 6) handleFileChange (UNCHANGED)
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setSummary("⏳ Uploading and processing...");
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: form,
      });
      const { summary: txt } = await res.json();
      setSummary(txt);
    } catch {
      setSummary('❌ Failed to upload or process the file.');
    }
  };

  // 7) handleGenerateStructured (UNCHANGED)
  const handleGenerateStructured = async () => {
    if (!summary) return;
    setStructSummary('⏳ Generating...');
    try {
      const res = await fetch('http://localhost:8000/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summary, fmt: format }),
      });
      const { summary: out } = await res.json();
      setStructSummary(out);
    } catch {
      setStructSummary('❌ Failed to generate structured summary.');
    }
  };

  // 8) handleAnalyze (UNCHANGED)
  const handleAnalyze = async () => {
    if (!summary) return;
    setAnalysisResults(null);
    try {
      const res = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summary }),
      });
      const { data, raw } = await res.json();
      setAnalysisResults(raw ? { raw } : { data });
    } catch {
      setAnalysisResults({ error: 'Analysis failed.' });
    }
  };

  // 9) handleExport (UNCHANGED)
  const handleExport = async () => {
    if (!summary) return;
    const payload = { summary, structured: structSummary };
    const res = await fetch('http://localhost:8000/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.docx';
    a.click();
  };

  // ─── LOGIN/SIGNUP Handlers ────────────────────────────────────────────────────

  const doLogin = async () => {
    try {
      const res = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Login failed");
      const data = await res.json();
      setToken(data.access_token);
      setShowLogin(false);
      setEmail("");
      setPassword("");
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  };

  const doSignup = async () => {
    try {
      const res = await fetch("http://localhost:8000/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Signup failed");

      // Auto‐login after successful signup
      const loginRes = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) throw new Error("Login after signup failed");
      const loginData = await loginRes.json();
      setToken(loginData.access_token);

      setShowSignup(false);
      setEmail("");
      setPassword("");
    } catch (err) {
      alert("Signup or login failed: " + err.message);
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  // If not logged in → show Home screen with Login/Signup buttons
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <div className="bg-gray-800 p-10 rounded-2xl shadow-xl w-96 text-center">
          <h1 className="text-4xl font-bold mb-6">ChatGPT El Ghalaba</h1>
          <button
            onClick={() => setShowSignup(true)}
            className="w-full mb-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold"
          >
            Signup
          </button>
          <button
            onClick={() => setShowLogin(true)}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold"
          >
            Login
          </button>
        </div>

        {/* LOGIN MODAL */}
        {showLogin && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-gray-800 p-6 rounded-xl w-80">
              <h2 className="text-2xl font-semibold mb-4 text-center">Login</h2>
              <input
                type="email"
                placeholder="Email"
                className="w-full mb-2 p-2 rounded-xl bg-gray-700 border border-gray-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full mb-4 p-2 rounded-xl bg-gray-700 border border-gray-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowLogin(false);
                    setEmail("");
                    setPassword("");
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={doLogin}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl"
                >
                  Login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SIGNUP MODAL */}
        {showSignup && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-gray-800 p-6 rounded-xl w-80">
              <h2 className="text-2xl font-semibold mb-4 text-center">Signup</h2>
              <input
                type="email"
                placeholder="Email"
                className="w-full mb-2 p-2 rounded-xl bg-gray-700 border border-gray-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full mb-4 p-2 rounded-xl bg-gray-700 border border-gray-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowSignup(false);
                    setEmail("");
                    setPassword("");
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={doSignup}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  Signup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // If logged in → show the main app (sidebar + chat/search/upload/etc.)
  return (
    <div className="flex min-h-screen w-full bg-gray-900 text-white">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/*  Sidebar (25% width) */}
      <div className="w-1/4 bg-gray-800 p-4 border-r border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">Conversations</h2>

        {/* New Chat button */}
        <button
          onClick={createNewConversation}
          className="w-full mb-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-sm font-semibold"
        >
          + New Chat
        </button>

        {/* List of conversations */}
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`relative flex items-center justify-between p-2 rounded-xl cursor-pointer ${
                conv.id === currentConvId
                  ? 'bg-indigo-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              onClick={() => selectConversation(conv)}
            >
              <div>
                <p className="font-medium text-sm">{conv.title}</p>
                <div className="text-xs opacity-70">
                  {new Date(conv.created_at).toLocaleString()}
                </div>
              </div>
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // prevent this row’s onClick from firing
                  deleteConversation(conv.id);
                }}
                className="ml-2 text-xl leading-none text-red-400 hover:text-red-600"
                title="Delete conversation"
              >
                🗑️
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="text-sm opacity-50">No conversations yet.</div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/*  Main area (75% width) */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold text-center flex-1">🤖 ChatGPT El Ghalaba</h1>
          <button
            onClick={() => {
              setToken(null);
              setConversations([]);
              setCurrentConvId(null);
              setMessages([]);
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-semibold"
          >
            Logout
          </button>
        </div>

        {/* Chat Window */}
        <div className="bg-gray-800 rounded-xl p-4 space-y-4">
          {!currentConvId ? (
            <div className="text-center text-sm opacity-70">
              Select a conversation or create a new one.
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-[75%] p-3 rounded-xl text-lg ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 ml-auto'
                      : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs opacity-70 mb-1">
                    <span>{msg.sender === 'bot' ? '🤖' : '👤'}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-line">{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        {currentConvId && (
          <div className="flex space-x-3">
            <input
              className="flex-1 p-3 rounded-xl bg-gray-800 border border-gray-700 focus:outline-none"
              placeholder="Ektb so2alak..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="px-5 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold"
            >
              Send
            </button>
          </div>
        )}

        {/* Web Search */}
        <div className="space-y-2">
          <label className="font-semibold">🔍 Web Search:</label>
          <div className="flex space-x-3">
            <input
              className="flex-1 p-3 rounded-xl bg-gray-800 border border-gray-700 focus:outline-none"
              placeholder="Type search terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="px-5 py-3 bg-green-500 hover:bg-green-600 rounded-xl font-semibold"
            >
              {searchLoading ? '...' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-3 space-y-2">
              {searchResults.map((r, idx) => (
                <a
                  key={idx}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 hover:bg-gray-700 rounded-lg"
                >
                  <h3 className="font-semibold">{r.title}</h3>
                  {r.snippet && <p className="text-sm opacity-80">{r.snippet}</p>}
                  <p className="text-xs opacity-60 truncate">{r.url}</p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Upload & Summaries */}
        <div className="space-y-2">
          <label className="font-semibold">📎 Upload Document:</label>
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full p-2 rounded-xl bg-gray-800 border border-gray-700 focus:outline-none"
          />
          {fileName && <div>📄 {fileName}</div>}
          {summary && (
            <div className="bg-yellow-300 text-black p-3 rounded-xl whitespace-pre-line">
              {summary}
            </div>
          )}

          {/* Structured Summary */}
          <div className="flex items-center space-x-2">
            <label className="font-semibold">Format:</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="p-2 rounded-xl bg-gray-800 border border-gray-700 focus:outline-none"
            >
              <option value="bullet">Bullet Points</option>
              <option value="json">JSON</option>
            </select>
            <button
              onClick={handleGenerateStructured}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-semibold"
            >
              Generate Structured
            </button>
          </div>
          {structSummary && (
            <div className="bg-gray-800 p-3 rounded-xl whitespace-pre-line">
              {structSummary}
            </div>
          )}

          {/* Analyze & Export */}
          <div className="flex space-x-2">
            <button
              onClick={handleAnalyze}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-xl font-semibold"
            >
              Analyze Findings
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-xl font-semibold"
            >
              Export Report
            </button>
          </div>
          {analysisResults && (
            <div className="bg-gray-800 p-3 rounded-xl whitespace-pre-line">
              {analysisResults.raw
                ? analysisResults.raw
                : JSON.stringify(analysisResults.data, null, 2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
