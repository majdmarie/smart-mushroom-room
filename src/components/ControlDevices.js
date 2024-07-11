import React, { useEffect, useState } from 'react';
import { database, ref, get, set, onValue, off, push } from '../firebase';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import AirIcon from '@mui/icons-material/Air';
import FanIcon from '@mui/icons-material/AcUnit';
import WbIncandescentIcon from '@mui/icons-material/WbIncandescent';
import OpacityIcon from '@mui/icons-material/Opacity';
import Box from '@mui/material/Box';

const ControlDevices = ({ roomId }) => {
  const [actuatorStates, setActuatorStates] = useState({});
  const [mode, setMode] = useState('automatic');

  const [airConditionState, setAirConditionState] = useState('on');
  const [coolingState, setCoolingState] = useState('off');
  const [rotatingState, setRotatingState] = useState('off');
  const [coolingPower, setCoolingPower] = useState('P3');
  const [heatingPower, setHeatingPower] = useState('H2');
  const [airConditionTemperature, setAirConditionTemperature] = useState(25);

  const coolingPowers = ['P3', 'P2', 'P1'];

  useEffect(() => {
    const actuatorsRef = ref(database, `/rooms/${roomId}/actuators`);
    const modeRef = ref(database, `/rooms/${roomId}/mode`);

    const handleActuatorsValue = (snapshot) => {
      setActuatorStates(snapshot.val() || {});
    };

    const handleModeValue = (snapshot) => {
      setMode(snapshot.val() || 'automatic');
    };

    onValue(actuatorsRef, handleActuatorsValue);
    onValue(modeRef, handleModeValue);

    return () => {
      off(actuatorsRef, 'value', handleActuatorsValue);
      off(modeRef, 'value', handleModeValue);
    };
  }, [roomId]);

  const toggleMode = () => {
    const newMode = mode === 'automatic' ? 'manual' : 'automatic';
    set(ref(database, `/rooms/${roomId}/mode`), newMode);
  };

  const toggleActuator = (actuator) => {
    if (mode === 'manual') {
      if (actuator === 'air_condition_actions') {
        if (airConditionState === 'on') {
          setAirConditionState('off');
          setCoolingState('off');
          setHeatingPower('H2');
          setCoolingPower('P3');
          setRotatingState('off');
          queueAirConditionAction('0xFFA05F');
        } else {
          setAirConditionState('on');
          queueAirConditionAction('0xFFA05F');
          queueAirConditionAction('0xFF50AF');
          queueAirConditionAction('0xFF6897');
        }
        actuator = 'air_condition';
      }

      const actuatorRef = ref(database, `/rooms/${roomId}/actuators/${actuator}`);
      get(actuatorRef).then((snapshot) => {
        const currentState = snapshot.val();
        const newState = !currentState;
        set(actuatorRef, newState);
      });
    }
  };

  const cycleCoolingPower = () => {
    const currentIndex = coolingPowers.indexOf(coolingPower);
    const nextIndex = (currentIndex + 1) % coolingPowers.length;
    const nextState = coolingPowers[nextIndex];
    setCoolingPower(nextState);
  };

  const queueAirConditionAction = (action) => {
    const queueRef = ref(database, `/rooms/${roomId}/air_condition_actions/actionQueue`);
    if (mode === 'manual') {
      // Cooling
      if (action === '0xFF50AF') {
        if (coolingState === 'off') {
          setCoolingState('on');
          setCoolingPower(coolingPowers[0]);
          setAirConditionTemperature(25);
          queueAirConditionAction('1xFF48B7');
        } 
        else {
          cycleCoolingPower();
        }
        action = '0xFF50AF';
        push(queueRef, { action, timestamp: Date.now() });
        action = '1xFF48B7';
      }
      // Heating
      else if (action === '0xFF10EF') {
        if (coolingState === 'on') {
          setCoolingState('off');
          setHeatingPower('H2');
          setAirConditionTemperature(45);
          queueAirConditionAction('1xFF48B7');
        } 
        else {
          if (heatingPower === 'H2') 
            setHeatingPower('H1');
          else 
            setHeatingPower('H2');
        }
        action = '0xFF10EF';
        push(queueRef, { action, timestamp: Date.now() });
        action = '1xFF48B7';
      }
      // Increase
      else if (action === '0xFF48B7') {
        if (coolingState === 'on' && airConditionTemperature >= 25) {
          setAirConditionTemperature(16);
        } else if (coolingState === 'off' && airConditionTemperature >= 45) {
          setAirConditionTemperature(25);
        } else {
          setAirConditionTemperature(airConditionTemperature + 1);
        }
      }
      // Decrease
      else if (action === '0xFF08F7') {
        if (coolingState === 'on' && airConditionTemperature <= 16) {
          setAirConditionTemperature(25);
        } else if (coolingState === 'off' && airConditionTemperature <= 25) {
          setAirConditionTemperature(45);
        } else {
          setAirConditionTemperature(airConditionTemperature - 1);
        }
      }
      else if (action === '0xFF6897') {
        if (rotatingState === 'on'){
          setRotatingState('off');
        }
        else{
          setRotatingState('on'); 
        }
      }
      if (action === '1xFF48B7') action = '0xFF48B7';
      push(queueRef, { action, timestamp: Date.now() });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Control Devices</Typography>
      <Grid container spacing={2} sx={{ mb: 5 }}>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            color={actuatorStates.fan ? "secondary" : "primary"}
            onClick={() => toggleActuator('fan')}
            startIcon={<FanIcon />}
            fullWidth
            sx={{ p: 2 }}
            disabled={mode === 'automatic'}
          >
            Fan: {actuatorStates.fan ? "ON" : "OFF"}
          </Button>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            color={actuatorStates.lamp ? "secondary" : "primary"}
            onClick={() => toggleActuator('lamp')}
            startIcon={<WbIncandescentIcon />}
            fullWidth
            sx={{ p: 2 }}
            disabled={mode === 'automatic'}
          >
            Lamp: {actuatorStates.lamp ? "ON" : "OFF"}
          </Button>
        </Grid>
        <Grid item xs={12} md={3}>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            color={actuatorStates.humidity_mister ? "secondary" : "primary"}
            onClick={() => toggleActuator('humidity_mister')}
            startIcon={<OpacityIcon />}
            fullWidth
            sx={{ p: 2 }}
            disabled={mode === 'automatic'}
          >
            Humidity Mister: {actuatorStates.humidity_mister ? "ON" : "OFF"}
          </Button>
        </Grid>
        <Grid item xs={12} md={12}>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            color={airConditionState === 'on' ? "secondary" : "primary"}
            onClick={() => toggleActuator('air_condition_actions')}
            startIcon={<AirIcon />}
            fullWidth
            sx={{ p: 2 }}
            disabled={mode === 'automatic'}
          >
            Air Condition: {airConditionState === 'on' ? airConditionTemperature + " C" : "OFF"}
          </Button>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            onClick={() => queueAirConditionAction('0xFF48B7')}
            fullWidth
            sx={{ p: 2 }}
            disabled={mode === 'automatic' || airConditionState === 'off'}
          >
            Air Condition: Increase
          </Button>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            onClick={() => queueAirConditionAction('0xFF08F7')}
            fullWidth
            sx={{ p: 2 }}
            disabled={mode === 'automatic' || airConditionState === 'off'}
          >
            Air Condition: Decrease
          </Button>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            color={coolingState === 'off' ? "secondary" : "primary"}
            onClick={() => queueAirConditionAction('0xFF10EF')}
            fullWidth
            sx={{ p: 2 }}
            disabled={mode === 'automatic' || airConditionState === 'off'}
          >
            Air Condition: Heating {heatingPower}
          </Button>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            color={coolingState === 'on' ? "secondary" : "primary"}
            onClick={() => queueAirConditionAction('0xFF50AF')}
            fullWidth
            sx={{ p: 2 }}
            disabled={mode === 'automatic' || airConditionState === 'off'}
          >
            Air Condition: Cooling {coolingPower}
          </Button>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            color={rotatingState === 'on' ? "secondary" : "primary"}
            onClick={() => queueAirConditionAction('0xFF6897')}
            fullWidth
            sx={{ p: 2 }}
            disabled={mode === 'automatic' || airConditionState === 'off'}
          >
            Air Condition: Rotate
          </Button>
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={toggleMode}
            fullWidth
            sx={{ p: 2, bgcolor: 'black' }}
          >
            Switch to {mode === 'automatic' ? 'Manual' : 'Automatic'} Mode
          </Button>
        </Grid>
      </Grid>
      <div className="iv-embed" style={{ margin: '0 auto', padding: '0', border: '0', width: '642px' }}>
        <div className="iv-v" style={{ display: 'block', margin: '0', padding: '1px', border: '0', background: '#000' }}>
          <iframe className="iv-i" style={{ display: 'block', margin: '0', padding: '0', border: '0' }} src="https://open.ivideon.com/embed/v3/?server=100-j6w9tfJ2n6xWGPekYX4sx3&amp;camera=0&amp;width=&amp;height=&amp;lang=en" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; clipboard-write; picture-in-picture"></iframe>
        </div>
        <div className="iv-b" style={{ display: 'block', margin: '0', padding: '0', border: '0' }}>
          <div style={{ float: 'right', textAlign: 'right', padding: '0 0 10px', lineHeight: '10px' }}>
            <a className="iv-a" style={{ font: '10px Verdana,sans-serif', color: 'inherit', opacity: '.6' }} href="https://www.ivideon.com/" target="_blank">Powered by Ivideon</a>
          </div>
          <div style={{ clear: 'both', height: '0', overflow: 'hidden' }}>&nbsp;</div>
          <script src="https://open.ivideon.com/embed/v3/embedded.js"></script>
        </div>
      </div>
    </Box>
  );
};

export default ControlDevices;