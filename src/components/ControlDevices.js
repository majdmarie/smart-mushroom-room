// src/components/ControlDevices.js
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
      const updateActuators = (newState) => {
        set(ref(database, `/rooms/${roomId}/actuators/air_condition`), newState);
        set(ref(database, `/rooms/${roomId}/actuators/humidity_mister`), newState);
      };
  
      if (actuator === 'air_condition_actions') {
        if (airConditionState === 'on') {
          setAirConditionState('off');
          setCoolingState('off');
          setHeatingPower('H2');
          setCoolingPower('P3');
        } else {
          setAirConditionState('on');
          queueAirConditionAction('0xFFA05F');
          queueAirConditionAction('0xFF50AF');
          queueAirConditionAction('0xFF6897');
        }
        return;
      }
  
      const actuatorRef = ref(database, `/rooms/${roomId}/actuators/${actuator}`);
      get(actuatorRef).then((snapshot) => {
        const currentState = snapshot.val();
        const newState = !currentState;
        if (actuator === 'humidity_mister') {
          updateActuators(newState);
        } else {
          set(actuatorRef, newState);
        }
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
    if (mode === 'manual') {
      // Cooling
      if(action === '0xFF50AF'){
        if(coolingState === 'off'){
          setCoolingState('on');
          setCoolingPower(coolingPowers[0]);
          setAirConditionTemperature(25);
          queueAirConditionAction('1xFF48B7');
        }
        else{
          cycleCoolingPower();
        }
      }
      // Heating
      else if(action === '0xFF10EF'){
        if(coolingState === 'on'){
          setCoolingState('off');
          setHeatingPower('H2');
          setAirConditionTemperature(30);
          queueAirConditionAction('1xFF48B7');
        }
        else{
          if(heatingPower === 'H2')
            setHeatingPower('H1');
          else
            setHeatingPower('H2');
        }
      }
      // Increase
      else if(action === '0xFF48B7'){
        if(coolingState === 'on' && airConditionTemperature >= 25){
          setAirConditionTemperature(16);
        }
        else if(coolingState === 'off' && airConditionTemperature >= 45){
          setAirConditionTemperature(25);
        }
        else{
          setAirConditionTemperature(airConditionTemperature + 1);
        }
      }
      // Decrease
      else if(action === '0xFF08F7'){
        if(coolingState === 'on' && airConditionTemperature <= 16){
          setAirConditionTemperature(25);
        }
        else if(coolingState === 'off' && airConditionTemperature <= 25){
          setAirConditionTemperature(45);
        }
        else{
          setAirConditionTemperature(airConditionTemperature - 1);
        }
      }
      if(action === '1xFF48B7')
        action = '0xFF48B7';
      const queueRef = ref(database, `/rooms/${roomId}/air_condition_actions/actionQueue`);
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
        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={toggleMode}
            fullWidth
            sx={{ p: 2, bgcolor: 'black', }}
          >
            Switch to {mode === 'automatic' ? 'Manual' : 'Automatic'} Mode
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ControlDevices;


