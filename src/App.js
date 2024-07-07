// src/App.js
import React, { useEffect, useState } from 'react';
import { auth } from './firebase';
import Login from './components/Login';
import SensorData from './components/SensorData';
import ControlDevices from './components/ControlDevices';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Container from '@mui/material/Container';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import theme from './theme';
import Box from '@mui/material/Box';
import { Typography } from '@mui/material';
import { BrowserRouter as Router, Route, Routes, Link, useLocation } from 'react-router-dom';

const NavigationBar = ({ user, onLogout }) => {
  const location = useLocation();

  return (
    <AppBar position="static">
      <Toolbar>
        {user && (
          <>
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <Button
                color="inherit"
                component={Link}
                to="/monitor"
                sx={{
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  mx: 1,
                  px: 2,
                  py: 1,
                  backgroundColor: location.pathname === '/monitor' || location.pathname === '/' ? 'secondary.main' : 'inherit',
                  '&:hover': {
                    backgroundColor: location.pathname === '/monitor' || location.pathname === '/' ? 'secondary.dark' : 'inherit',
                  },
                }}
              >
                Monitor
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/control"
                sx={{
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  mx: 1,
                  px: 2,
                  py: 1,
                  backgroundColor: location.pathname === '/control' ? 'secondary.main' : 'inherit',
                  '&:hover': {
                    backgroundColor: location.pathname === '/control' ? 'secondary.dark' : 'inherit',
                  },
                }}
              >
                Control
              </Button>
            </Box>
            <Button
              color="secondary"
              variant="contained"
              onClick={onLogout}
              sx={{ fontSize: '1.2rem', mx: 1, px: 2, py: 1, bgcolor: 'black' }}
            >
              Logout
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setUser(user);
        setRoomId(user.email.split('@')[0]);
      } else {
        setUser(null);
        setRoomId('');
      }
    });
    return () => unsubscribe();
  }, []);

  const formatRoomName = (id) => `Room ${id.replace(/\D/g, '')}`;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <NavigationBar user={user} onLogout={() => auth.signOut()} />
        <Container sx={{ mt: 3 }}>
          {!user ? (
            <Login onLogin={(email) => setRoomId(email.split('@')[0])} />
          ) : (
            <Routes>
              <Route path="/monitor" element={
                <Box>
                  <Typography variant="h2" align="center" gutterBottom>{formatRoomName(roomId)}</Typography>
                  <SensorData roomId={roomId.toLowerCase().replace(' ', '')} />
                </Box>
              } />
              <Route path="/control" element={<ControlDevices roomId={roomId.toLowerCase().replace(' ', '')} />} />
              <Route path="/" element={
                <Box>
                  <Typography variant="h2" align="center" gutterBottom>{formatRoomName(roomId)}</Typography>
                  <SensorData roomId={roomId.toLowerCase().replace(' ', '')} />
                </Box>
              } />
            </Routes>
          )}
        </Container>
      </Router>
    </ThemeProvider>
  );
};

export default App;
