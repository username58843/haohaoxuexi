import React from 'react'
import { useRouter } from 'next/router'
import { Container, Row, Col, Card, CardBody, Button, Badge } from 'reactstrap'
import Link from '~/components/Link'
import { useAuth } from '~/lib/contexts/AuthContext'
import HeroAnimation from '~/components/Landing/HeroAnimation'

export default function LandingPage() {
  const { user } = useAuth()
  const router = useRouter()

  return (
    <div className="site-shell" style={{ color: '#fff', padding: '40px 0' }}>
      <Container>
        {/* Hero Section */}
        <Row className="text-center mb-5">
          <Col>
            {!user ? (
              <HeroAnimation />
            ) : (
              <>
                <h1 style={{ fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#fff' }}>
                  好好学习
                </h1>
                <p style={{ fontSize: '1.5rem', color: '#aaa', marginBottom: '2rem' }}>
                  Welcome back, {user.name}!
                </p>
                <Button 
                  color="primary" 
                  size="lg" 
                  className="me-2"
                  onClick={() => router.push('/learn')}
                >
                  Go to Dashboard
                </Button>
              </>
            )}
            {!user && (
              <div style={{ marginTop: '30px' }}>
                <Button 
                  color="primary" 
                  size="lg" 
                  className="me-2"
                  onClick={() => router.push('/auth')}
                  style={{
                    background: 'linear-gradient(45deg, #ff3b30, #ff6666)',
                    border: 'none',
                    padding: '15px 40px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    boxShadow: '0 5px 20px rgba(255, 59, 48, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)'
                    e.target.style.boxShadow = '0 8px 25px rgba(255, 59, 48, 0.6)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)'
                    e.target.style.boxShadow = '0 5px 20px rgba(255, 59, 48, 0.4)'
                  }}
                >
                  Get Started Free
                </Button>
              </div>
            )}
          </Col>
        </Row>

        {/* Features Section */}
        <Row className="mb-5">
          <Col>
            <h2 className="text-center mb-4">Features</h2>
          </Col>
        </Row>
        <Row>
          <Col md={4} className="mb-4">
            <Card className="glass h-100">
              <CardBody>
                <h3>📚 Dictionary Search</h3>
                <p>Search through comprehensive Chinese dictionaries with detailed information including:</p>
                <ul>
                  <li>Chinese characters (Simplified & Traditional)</li>
                  <li>Pinyin pronunciation</li>
                  <li>English translations</li>
                  <li>Stroke order animations</li>
                  <li>Audio pronunciation</li>
                  <li>Example sentences</li>
                </ul>
              </CardBody>
            </Card>
          </Col>
          <Col md={4} className="mb-4">
            <Card className="glass h-100">
              <CardBody>
                <h3>🌐 Text Translator</h3>
                <p>Translate texts between Chinese, Russian, English, and Turkmen:</p>
                <ul>
                  <li>AI-powered translation (default)</li>
                  <li>Machine translation option</li>
                  <li>Bidirectional translation</li>
                  <li>Support for long texts</li>
                </ul>
              </CardBody>
            </Card>
          </Col>
          <Col md={4} className="mb-4">
            <Card className="glass h-100">
              <CardBody>
                <h3>📖 Learning Mode</h3>
                <p>Practice Chinese vocabulary with interactive flashcards:</p>
                <ul>
                  <li>Multiple learning modes</li>
                  <li>Progress tracking</li>
                  <li>Error review</li>
                  <li>Customizable word lists</li>
                </ul>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Pricing Section */}
        <Row className="mt-5 mb-5">
          <Col>
            <h2 className="text-center mb-4">Pricing</h2>
          </Col>
        </Row>
        <Row>
          <Col md={6} className="mb-4">
            <Card className="glass h-100">
              <CardBody>
                <h3 className="text-center">Free</h3>
                <div className="text-center mb-3">
                  <span style={{ fontSize: '2rem' }}>$0</span>
                  <span className="text-muted">/month</span>
                </div>
                <ul>
                  <li>✓ Dictionary search</li>
                  <li>✓ Text translation</li>
                  <li>✓ Learning mode</li>
                  <li>✓ 6 example sentences per word</li>
                  <li>✓ Basic features</li>
                </ul>
              </CardBody>
            </Card>
          </Col>
          <Col md={6} className="mb-4">
            <Card className="glass h-100" style={{ borderColor: 'rgba(255,59,48,0.45)', borderWidth: '2px' }}>
              <CardBody>
                <div className="text-center mb-2">
                  <Badge color="danger">PREMIUM</Badge>
                </div>
                <h3 className="text-center">Premium</h3>
                <div className="text-center mb-3">
                  <span style={{ fontSize: '2rem' }}>$9.99</span>
                  <span className="text-muted">/month</span>
                </div>
                <ul>
                  <li>✓ Everything in Free</li>
                  <li>✓ 10 example sentences per word</li>
                  <li>✓ Personal dictionaries</li>
                  <li>✓ Search history</li>
                  <li>✓ Priority support</li>
                  <li>✓ Advanced features</li>
                </ul>
                {!user && (
                  <div className="text-center mt-3">
                    <Button 
                      color="primary" 
                      block
                      onClick={() => router.push('/auth')}
                    >
                      Get Premium
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Footer */}
        <Row className="mt-5">
          <Col className="text-center">
            <p className="text-muted">© {new Date().getFullYear()} 好好学习: Chinese Language. All rights reserved.</p>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

