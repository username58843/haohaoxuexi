import React, { useState, useEffect } from 'react'
import { Card, CardBody } from 'reactstrap'

const ChineseCharacters = ['学', '习', '汉', '语', '中', '文', '词', '典']

export default function HeroAnimation() {
  const [currentChars, setCurrentChars] = useState([])
  const [animating, setAnimating] = useState(true)
  const [showFeatures, setShowFeatures] = useState(false)

  useEffect(() => {
    let index = 0
    const interval = setInterval(() => {
      if (index < ChineseCharacters.length) {
        setCurrentChars(prev => [...prev, ChineseCharacters[index]])
        index++
      } else {
        setAnimating(false)
        setTimeout(() => setShowFeatures(true), 300)
        clearInterval(interval)
      }
    }, 200)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="hero-animation-container" style={{ 
      minHeight: '400px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '40px 0'
    }}>
      <Card
        className="glass-strong"
        style={{ 
        maxWidth: '800px',
        width: '100%'
      }}>
        <CardBody style={{ padding: '60px 40px' }}>
          <div className="text-center">
            <h2 style={{ 
              fontSize: '2.5rem', 
              marginBottom: '30px',
              color: '#fff',
              fontWeight: 'bold'
            }}>
              Welcome to <span className="hanzi" lang="zh">好好学习</span>
            </h2>
            <div style={{ 
              fontSize: '4rem', 
              minHeight: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '20px',
              marginBottom: '30px'
            }}>
              {currentChars.map((char, idx) => (
                <span
                  key={idx}
                  className="hanzi"
                  lang="zh"
                  style={{
                    display: 'inline-block',
                    animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`,
                    color: '#ff3b30',
                    fontWeight: 600,
                    textShadow: '0 0 20px rgba(255, 59, 48, 0.5)'
                  }}
                >
                  {char}
                </span>
              ))}
              {!animating && (
                <span style={{
                  display: 'inline-block',
                  animation: 'pulse 2s ease-in-out infinite',
                  color: '#ff3b30',
                  fontSize: '3rem',
                  marginLeft: '10px'
                }}>
                  ✨
                </span>
              )}
            </div>
            <p style={{ 
              fontSize: '1.2rem', 
              color: '#aaa',
              lineHeight: '1.8',
              marginBottom: '40px'
            }}>
              Your complete platform for learning Chinese vocabulary.<br />
              Search dictionaries and practice with interactive flashcards.
            </p>
            {showFeatures && (
              <div style={{
                display: 'flex',
                gap: '20px',
                justifyContent: 'center',
                flexWrap: 'wrap',
                animation: 'fadeInUp 0.8s ease-out'
              }}>
                <div style={{
                  backgroundColor: '#2c2c2e',
                  padding: '25px',
                  borderRadius: '12px',
                  minWidth: '220px',
                  border: '2px solid #444',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)'
                  e.currentTarget.style.borderColor = '#ff3b30'
                  e.currentTarget.style.boxShadow = '0 5px 20px rgba(255, 59, 48, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = '#444'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '15px', animation: 'pulse 2s ease-in-out infinite' }}>📚</div>
                  <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '8px', fontSize: '1.1rem' }}>Dictionary</div>
                  <div style={{ fontSize: '0.95rem', color: '#aaa' }}>Search & Learn</div>
                </div>
                <div style={{
                  backgroundColor: '#2c2c2e',
                  padding: '25px',
                  borderRadius: '12px',
                  minWidth: '220px',
                  border: '2px solid #444',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)'
                  e.currentTarget.style.borderColor = '#ff3b30'
                  e.currentTarget.style.boxShadow = '0 5px 20px rgba(255, 59, 48, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = '#444'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '15px', animation: 'pulse 2s ease-in-out infinite' }}>🌐</div>
                  <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '8px', fontSize: '1.1rem' }}>Translator</div>
                  <div style={{ fontSize: '0.95rem', color: '#aaa' }}>AI Powered</div>
                </div>
                <div style={{
                  backgroundColor: '#2c2c2e',
                  padding: '25px',
                  borderRadius: '12px',
                  minWidth: '220px',
                  border: '2px solid #444',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)'
                  e.currentTarget.style.borderColor = '#ff3b30'
                  e.currentTarget.style.boxShadow = '0 5px 20px rgba(255, 59, 48, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = '#444'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '15px', animation: 'pulse 2s ease-in-out infinite' }}>📖</div>
                  <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '8px', fontSize: '1.1rem' }}>Learning</div>
                  <div style={{ fontSize: '0.95rem', color: '#aaa' }}>Interactive Cards</div>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  )
}

