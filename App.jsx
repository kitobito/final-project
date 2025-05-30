import { useState } from 'react';

function App() {
  const [messages, setMessages]       = useState([
    { sender: 'bot'
    , text:   'Ahlan beek fy ChatGPT El Ghalaba! Es2alny ay so2al aw esbaat file ala5asholak.'
    , timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [input, setInput]             = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [fileName, setFileName]       = useState(null);
  const [summary, setSummary]         = useState('');

  // ─── Send a chat message (with full history) ────────────────────────────
  const sendMessage = async () => {
    if (!input.trim()) return;

    // 1) Add user to UI
    setMessages(prev => [
      ...prev,
      { sender:'user', text: input, timestamp: new Date().toLocaleTimeString() }
    ]);

    // 2) Build chat payload for backend
    const chatHistory = [
      { role: 'system'
      , content: 'You are a helpful assistant that remembers the conversation.'
      },
      ...messages.map(m => ({
        role:    m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      })),
      { role: 'user', content: input }
    ];

    setInput('');

    // 3) Call /ask
    try {
      const res = await fetch('http://127.0.0.1:8000/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: chatHistory }),
      });
      const { answer } = await res.json();
      setMessages(prev => [
        ...prev,
        { sender:'bot', text: answer, timestamp: new Date().toLocaleTimeString() }
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { sender:'bot', text:'❌ Failed to fetch answer', timestamp:new Date().toLocaleTimeString() }
      ]);
    }
  };

  // ─── Web search ─────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/search?q=${encodeURIComponent(searchQuery)}`
      );
      const { results } = await res.json();
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  // ─── File upload & summarize ───────────────────────────────────────────
  const handleFileChange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setSummary('⏳ Uploading and processing...');
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('http://127.0.0.1:8000/upload', {
        method: 'POST',
        body: form
      });
      const { summary: txt } = await res.json();
      setSummary(txt);
    } catch {
      setSummary('❌ Failed to upload or process the file.');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-gray-900">
      <div className="max-w-4xl mx-auto flex flex-col p-6 space-y-6 bg-gray-800">

        {/* Header */}
        <h1 className="text-4xl font-bold text-center text-white">
          🤖 ChatGPT El Ghalaba 
        </h1>

        {/* Chat Window */}
        <div className="bg-gray-700 rounded-lg p-4 space-y-4">
          {messages.map((msg,i) => (
            <div
              key={i}
              className={`relative max-w-[75%] p-3 rounded-xl text-lg ${
                msg.sender==='user'
                  ? 'bg-blue-600 ml-auto text-white'
                  : 'bg-gray-600 text-white'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xl">
                  {msg.sender==='bot' ? '🤖' : '👤'}
                </span>
                <span className="text-xs opacity-60 absolute bottom-1 right-3">
                  {msg.timestamp}
                </span>
              </div>
              <div className="whitespace-pre-line">{msg.text}</div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="flex space-x-3">
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&sendMessage()}
            placeholder="Ektb so2alak..."
            className="flex-1 p-3 rounded-xl bg-gray-700 border border-gray-600 text-white focus:outline-none"
          />
          <button
            onClick={sendMessage}
            className="px-5 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold text-white"
          >
            Send
          </button>
        </div>

        {/* Web Search */}
        <div className="space-y-2">
          <div className="flex space-x-3">
            <input
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSearch()}
              placeholder="Search the web..."
              className="flex-1 p-3 rounded-xl bg-gray-700 border border-gray-600 text-white focus:outline-none"
            />
            <button
              onClick={handleSearch}
              className="px-5 py-3 bg-green-500 hover:bg-green-600 rounded-xl font-semibold text-white"
            >
              {searchLoading ? '...' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="bg-gray-700 rounded-lg p-3 space-y-3">
              {searchResults.map((r,idx) => (
                <a
                  key={idx}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 hover:bg-gray-600 rounded-lg"
                >
                  <h3 className="font-semibold text-white">{r.title}</h3>
                  {r.snippet && (
                    <p className="text-sm opacity-80 mt-1">{r.snippet}</p>
                  )}
                  <p className="text-xs opacity-60 mt-1 truncate">{r.url}</p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* File Upload & Summary */}
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <label className="text-white text-lg">📎</label>
            <input
              type="file"
              onChange={handleFileChange}
              className="flex-1 p-2 bg-gray-700 rounded-xl text-white border border-gray-600 focus:outline-none"
            />
          </div>
          {fileName && (
            <div className="text-sm text-white">📄 {fileName}</div>
          )}
          {summary && (
            <div className="bg-yellow-300 text-black p-3 rounded-lg text-sm whitespace-pre-line">
              {summary}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
