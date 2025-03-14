import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function MessageApp() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch("http://localhost:5000/")
      .then((res) => res.text())
      .then((data) => setMessage(data));
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-5xl font-bold">{message}</h1>
    </div>
  );
}

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      {/* MathHub 標題部分 */}
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <h1 className="text-5xl font-bold">MathHub</h1>
      </div>

      {/* MathHub 內容部分 */}
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
export { MessageApp }
