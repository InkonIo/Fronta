import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
/* import Map from "./Map"; */
import './RegistrationModal.css';

export default function RegistrationModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(0);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatNewPassword, setRepeatNewPassword] = useState("");
  const [keepMeLoggedIn, setKeepMeLoggedIn] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setIsRegistered(true);

    const container = document.querySelector('.registration-modal');
    if (!container) return;

    const particles = [];
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 20 + 's';
      particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
      container.appendChild(particle);
      particles.push(particle);
    }

    return () => {
      particles.forEach(p => p.remove());
    };
  }, []);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    if (!login.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Пожалуйста, заполните все поля");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (!agree) {
      setError("Необходимо согласиться с обработкой персональных данных");
      return;
    }

    try {
      const response = await fetch('http://localhost:8080/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: login, email, password })
      });

      const result = await response.text();
      if (!response.ok) {
        setError(result || "Ошибка регистрации");
        return;
      }

      setError("Успешная регистрация! Теперь войдите в систему.");
      setIsLoginMode(true);
    } catch (err) {
      console.error("Ошибка регистрации:", err);
      setError("Сервер не отвечает");
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Введите email и пароль");
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Ошибка входа");
        return;
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      setIsRegistered(true);
      onSuccess?.();
    } catch (err) {
      console.error("Ошибка авторизации:", err);
      setError("Ошибка подключения к серверу");
    }
  }

  async function handleRecoverPassword(e) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Введите email");
      return;
    }

    try {
      if (recoveryStep === 1) {
        // verify code
        const response = await fetch("https://newback-production-aa83.up.railway.app/api/v1/recovery/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: recoveryCode })
        });

        if (!response.ok) {
          const data = await response.text();
          setError(data || "Неверный код");
          return;
        }

        setRecoveryStep(2);
      } else if (recoveryStep === 2) {
        if (newPassword !== repeatNewPassword) {
          setError("Пароли не совпадают");
          return;
        }

        const response = await fetch("https://newback-production-aa83.up.railway.app/api/v1/recovery/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, newPassword })
        });

        if (!response.ok) {
          const data = await response.text();
          setError(data || "Ошибка смены пароля");
          return;
        }

        alert("Пароль успешно обновлён!");
        setIsRecovering(false);
        setRecoveryStep(0);
        setRecoveryCode("");
        setNewPassword("");
        setRepeatNewPassword("");
      }
    } catch (err) {
      console.error("Ошибка восстановления:", err);
      setError("Сервер недоступен");
    }
  }

  async function startRecovery() {
    setError("");

    if (!email.trim()) {
      setError("Введите email для восстановления");
      return;
    }

    try {
      const response = await fetch("https://newback-production-aa83.up.railway.app/api/v1/recovery/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.text();
        setError(data || "Ошибка при отправке письма");
        return;
      }

      alert("Код восстановления отправлен на почту.");
      setIsRecovering(true);
      setRecoveryStep(1);
    } catch (err) {
      console.error("Ошибка восстановления:", err);
      setError("Сервер недоступен");
    }
  }

  if (isRegistered) return <Map />;

  return (
    <div className="registration-modal">
      <div className="modal-overlay" onClick={onClose}></div>
      <div className="registration-wrapper">
        <div className="registration-content">
          {!isRecovering && (
            <div className="auth-tabs">
              <div className={`auth-tab ${!isLoginMode ? "active" : ""}`} onClick={() => { setIsLoginMode(false); setError(""); }}>SIGN UP</div>
              <div className={`auth-tab ${isLoginMode ? "active" : ""}`} onClick={() => { setIsLoginMode(true); setError(""); }}>SIGN IN</div>
            </div>
          )}

          {!isLoginMode && !isRecovering && (
            <form className="registration-form" onSubmit={handleRegister}>
              <div className="input-group">
                <input type="text" placeholder="Username" value={login} onChange={(e) => setLogin(e.target.value)} required />
              </div>
              <div className="input-group">
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="input-group">
                <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              <label className="checkbox-label">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span className="checkmark"></span> I agree to the processing of personal data
              </label>
              {error && <div className="error">{error}</div>}
              <button type="submit" className="submit-btn">SIGN UP</button>
            </form>
          )}

          {isLoginMode && !isRecovering && (
            <form className="registration-form" onSubmit={handleLogin}>
              <div className="input-group">
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <label className="checkbox-label">
                <input type="checkbox" checked={keepMeLoggedIn} onChange={(e) => setKeepMeLoggedIn(e.target.checked)} />
                <span className="checkmark"></span> Keep me logged in
              </label>
              <div className="forgot-password" onClick={startRecovery} style={{ cursor: 'pointer', color: '##ff8c42', marginTop: '8px' }}>
                Forgot password?
              </div>
              {error && <div className="error">{error}</div>}
              <button type="submit" className="submit-btn">LOGIN</button>
            </form>
          )}

          {isRecovering && (
            <form className="registration-form" onSubmit={handleRecoverPassword}>
              <h2>Password Recovery</h2>
              {recoveryStep === 1 && (
                <div className="input-group">
                  <input type="text" placeholder="Code from email" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} required />
                </div>
              )}
              {recoveryStep === 2 && (
                <>
                  <div className="input-group">
                    <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <input type="password" placeholder="Repeat New Password" value={repeatNewPassword} onChange={(e) => setRepeatNewPassword(e.target.value)} required />
                  </div>
                </>
              )}
              {error && <div className="error">{error}</div>}
              <button type="submit" className="submit-btn">{recoveryStep === 1 ? 'Verify Code' : 'Set New Password'}</button>
              <button type="button" className="cancel-btn" onClick={() => { setIsRecovering(false); setRecoveryStep(0); setError(""); }} style={{ marginTop: '10px' }}>
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
