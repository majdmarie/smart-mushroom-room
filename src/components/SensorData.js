import React, { useEffect, useState } from 'react';
import { database, ref, onValue, off, set } from '../firebase';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LightModeIcon from '@mui/icons-material/LightMode';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

const SensorCard = ({ title, data, includeLight }) => (
  <Paper elevation={3} sx={{ p: 2, mb: 2, borderRadius: 3, width: '100%' }}>
    <Typography variant="h6" gutterBottom>{title}</Typography>
    <Grid container spacing={2} alignItems="center">
      <Grid item xs={6}>
        <Typography variant="body1"><ThermostatIcon color="secondary" sx={{ verticalAlign: 'middle', mr: 1 }} /> Temperature: {data.temperature} °C</Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="body1"><WaterDropIcon sx={{ color: 'darkcyan', verticalAlign: 'middle', mr: 1 }} /> Humidity: {data.humidity} %</Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="body1"><DeviceHubIcon sx={{ color: 'black', verticalAlign: 'middle', mr: 1 }} /> CO2: {data.mq_value}</Typography>
      </Grid>
      {includeLight && data.light !== undefined && (
        <Grid item xs={6}>
          <Typography variant="body1"><LightModeIcon sx={{ color: 'orange', verticalAlign: 'middle', mr: 1 }} /> Light: {data.light} lux</Typography>
        </Grid>
      )}
    </Grid>
  </Paper>
);

const SensorData = ({ roomId }) => {
  const [masterData, setMasterData] = useState({});
  const [slavesData, setSlavesData] = useState({});
  const [mode, setMode] = useState('automatic');
  const [stage, setStage] = useState('incubation');
  const [incubationDays, setIncubationDays] = useState(1);
  const [fruitingDays, setFruitingDays] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const roomPath = `/rooms/${roomId}`;
    const masterRef = ref(database, `${roomPath}/master`);
    const slavesRef = ref(database, `${roomPath}/slaves`);
    const modeRef = ref(database, `${roomPath}/mode`);
    const stageRef = ref(database, `${roomPath}/stage`);
    const incubationDaysRef = ref(database, `${roomPath}/incubationDays`);
    const fruitingDaysRef = ref(database, `${roomPath}/fruitingDays`);

    var masterCount = 0;
    var masterSum = { humidity: 0, light: 0, mq_value: 0, temperature: 0 };

    var slavesCount = 0;
    var slavesSum = {};

    var firstMasterMount = 1;
    var firstSlavesMount = 1;

    const handleMasterValue = (snapshot) => {
      setLastUpdateTime(Date.now());
      if(firstMasterMount){
        firstMasterMount = 0;
        setMasterData(snapshot.val());
        return;
      }

      const data = snapshot.val() || {};
      const parsedData = {
        humidity: parseFloat(data.humidity),
        light: parseFloat(data.light),
        mq_value: parseInt(data.mq_value),
        temperature: parseFloat(data.temperature)
      };

      for (let key in masterSum) {
        masterSum[key] += parsedData[key];
      }
      masterCount++;

      if (masterCount < 5) {
        return;
      }

      const averagedData = {};
      for (let key in masterSum) {
        averagedData[key] = (masterSum[key] / 5).toFixed(key === 'mq_value' ? 0 : 2);
      }

      setMasterData(averagedData);
      masterCount = 0;
      masterSum = { humidity: 0, light: 0, mq_value: 0, temperature: 0 };
    };

    const handleSlavesValue = (snapshot) => {
      setLastUpdateTime(Date.now());
      if(firstSlavesMount){
        firstSlavesMount = 0;
        setSlavesData(snapshot.val());
        return;
      }

      const data = snapshot.val() || {};
      
      if (slavesCount === 0) {
        for (let slave in data) {
          slavesSum[slave] = { humidity: 0, light: 0, mq_value: 0, temperature: 0 };
        }
      }

      for (let slave in data) {
        const parsedData = {
          humidity: parseFloat(data[slave].humidity),
          light: parseFloat(data[slave].light),
          mq_value: parseInt(data[slave].mq_value),
          temperature: parseFloat(data[slave].temperature)
        };
        for (let key in slavesSum[slave]) {
          slavesSum[slave][key] += parsedData[key];
        }
      }
      slavesCount++;

      if (slavesCount < 10) {
        return;
      }

      const averagedSlavesData = {};
      for (let slave in slavesSum) {
        averagedSlavesData[slave] = {};
        for (let key in slavesSum[slave]) {
          averagedSlavesData[slave][key] = (slavesSum[slave][key] / 10).toFixed(key === 'mq_value' ? 0 : 2);
        }
      }

      setSlavesData(averagedSlavesData);
      slavesCount = 0;
      slavesSum = {};
    };

    const handleModeValue = (snapshot) => {
      setMode(snapshot.val() || 'automatic');
    };

    const handleStageValue = (snapshot) => {
      setStage(snapshot.val() || 'incubation');
    };

    const handleIncubationDaysValue = (snapshot) => {
      setIncubationDays(snapshot.val() || 1);
    };

    const handleFruitingDaysValue = (snapshot) => {
      setFruitingDays(snapshot.val() || 1);
    };

    onValue(masterRef, handleMasterValue);
    onValue(slavesRef, handleSlavesValue);
    onValue(modeRef, handleModeValue);
    onValue(stageRef, handleStageValue);
    onValue(incubationDaysRef, handleIncubationDaysValue);
    onValue(fruitingDaysRef, handleFruitingDaysValue);

    return () => {
      off(masterRef, 'value', handleMasterValue);
      off(slavesRef, 'value', handleSlavesValue);
      off(modeRef, 'value', handleModeValue);
      off(stageRef, 'value', handleStageValue);
      off(incubationDaysRef, 'value', handleIncubationDaysValue);
      off(fruitingDaysRef, 'value', handleFruitingDaysValue);
    };
  }, [roomId]);

  useEffect(() => {
    const incrementDays = () => {
      if (stage === 'incubation') {
        setIncubationDays((prev) => prev + 1);
        set(ref(database, `/rooms/${roomId}/incubationDays`), incubationDays + 1);
      } else if (stage === 'fruiting') {
        setFruitingDays((prev) => prev + 1);
        set(ref(database, `/rooms/${roomId}/fruitingDays`), fruitingDays + 1);
      }
    };

    const intervalId = setInterval(incrementDays, 24 * 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [stage, roomId, incubationDays, fruitingDays]);

  useEffect(() => {
    const checkDataUpdate = () => {
      if (Date.now() - lastUpdateTime > 60 * 60 * 1000) {
        setShowWarning(true);
      }
    };

    const intervalId = setInterval(checkDataUpdate, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [lastUpdateTime]);

  const handleStageSwitch = () => {
    setDialogOpen(true);
  };

  const confirmStageSwitch = () => {
    set(ref(database, `/rooms/${roomId}/stage`), newStage);
    console.log(newStage);
    setDialogOpen(false);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const handleReset = () => {
    setResetDialogOpen(true);
  };

  const confirmReset = () => {
    set(ref(database, `/rooms/${roomId}/stage`), 'incubation');
    set(ref(database, `/rooms/${roomId}/incubationDays`), 1);
    set(ref(database, `/rooms/${roomId}/fruitingDays`), 1);
    setResetDialogOpen(false);
  };

  const closeResetDialog = () => {
    setResetDialogOpen(false);
  };

  const calculateAverages = () => {
    const totalSensors = 1 + Object.keys(slavesData).length;
    const average = (field) => {
      const masterValue = parseFloat(masterData[field]) || 0;
      const slavesValue = Object.values(slavesData).reduce((sum, slave) => sum + parseFloat(slave[field] || 0), 0);
      return (masterValue + slavesValue) / totalSensors;
    };
    return {
      temperature: average('temperature').toFixed(2),
      humidity: average('humidity').toFixed(2),
      mq_value: average('mq_value').toFixed(0)
    };
  };

  const renderWarnings = () => {
    const warnings = [];
    const isAutomatic = mode === 'automatic';

    if (stage === 'incubation' && incubationDays >= 14) {
      warnings.push(<Alert severity="warning" key="stage">It is recommended to move to the fruiting stage.</Alert>);
    }
    if (stage === 'fruiting' && fruitingDays >= 20) {
      warnings.push(<Alert severity="warning" key="harvest">It is recommended to start harvesting.</Alert>);
    }

    const { temperature, humidity, mq_value } = calculateAverages();

    if (stage === 'incubation') {
      if (temperature > 25) warnings.push(<Alert severity="error" key="temp-high-inc">{isAutomatic ? "Temperature is too high. Please make sure the actuators are working properly." : "Temperature is too high. Turn on cooling or switch to automatic mode."}</Alert>);
      if (temperature < 24) warnings.push(<Alert severity="error" key="temp-low-inc">{isAutomatic ? "Temperature is too low. Please make sure the actuators are working properly." : "Temperature is too low. Turn on heating or switch to automatic mode."}</Alert>);
      if (humidity > 100) warnings.push(<Alert severity="error" key="humid-high-inc">{isAutomatic ? "Humidity is too high. Please make sure the actuators are working properly." : "Humidity is too high. Turn off humidifier or switch to automatic mode."}</Alert>);
      if (humidity < 95) warnings.push(<Alert severity="error" key="humid-low-inc">{isAutomatic ? "Humidity is too low. Please make sure the actuators are working properly." : "Humidity is too low. Turn on humidifier or switch to automatic mode."}</Alert>);
      if (mq_value > 800) warnings.push(<Alert severity="error" key="co2-high-inc">{isAutomatic ? "CO2 is too high. Please make sure the actuators are working properly." : "CO2 is too high. Turn on fan or switch to automatic mode."}</Alert>);
    } else if (stage === 'fruiting') {
      if (temperature > 20) warnings.push(<Alert severity="error" key="temp-high-fruit">{isAutomatic ? "Temperature is too high. Please make sure the actuators are working properly." : "Temperature is too high. Turn on cooling or switch to automatic mode."}</Alert>);
      if (temperature < 18) warnings.push(<Alert severity="error" key="temp-low-fruit">{isAutomatic ? "Temperature is too low. Please make sure the actuators are working properly." : "Temperature is too low. Turn on heating or switch to automatic mode."}</Alert>);
      if (humidity > 90) warnings.push(<Alert severity="error" key="humid-high-fruit">{isAutomatic ? "Humidity is too high. Please make sure the actuators are working properly." : "Humidity is too high. Turn off humidifier or switch to automatic mode."}</Alert>);
      if (humidity < 85) warnings.push(<Alert severity="error" key="humid-low-fruit">{isAutomatic ? "Humidity is too low. Please make sure the actuators are working properly." : "Humidity is too low. Turn on humidifier or switch to automatic mode."}</Alert>);
      if (mq_value > 800) warnings.push(<Alert severity="error" key="co2-high-fruit">{isAutomatic ? "CO2 is too high. Please make sure the actuators are working properly." : "CO2 is too high. Turn on fan or switch to automatic mode."}</Alert>);
    }

    return warnings.length > 0 ? warnings : null;
  };

  const formattedStage = stage.charAt(0).toUpperCase() + stage.slice(1);
  const stageDisplay = stage === 'incubation' ? `Stage Name: ${formattedStage} Stage (1st)` : `Stage Name: ${formattedStage} Stage (2nd)`;

  return (
    <Box display="flex" flexDirection="column" alignItems="center">
      <Grid container spacing={5} justifyContent="center" maxWidth="lg">
        <Grid item xs={12} md={6}>
          <Typography variant="h4" gutterBottom>Sensors Data</Typography>
          <SensorCard title="Master" data={masterData} includeLight={false} />
          {Object.keys(slavesData).map(slaveID => (
            <SensorCard key={slaveID} title={`Slave ${slaveID.charAt(slaveID.length - 1)}`} data={slavesData[slaveID]} includeLight={true} />
          ))}
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="h4" gutterBottom>Stage</Typography>
          <Paper elevation={3} sx={{ p: 2, mb: 2, borderRadius: 3 }}>
            <Typography variant="h6">{stageDisplay}</Typography>
            <Typography variant="body1">Number of days: {stage === 'incubation' ? incubationDays : fruitingDays} Days</Typography>
            {renderWarnings()}
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                setNewStage(stage === 'incubation' ? 'fruiting' : 'incubation');
                handleStageSwitch();
              }}
              fullWidth
              sx={{ p: 2, mt: 2 }}
            >
              Switch to {stage === 'incubation' ? 'Fruiting' : 'Incubation'} Stage
            </Button>
          </Paper>
        </Grid>
      </Grid>
      <Button
        variant="contained"
        onClick={handleReset}
        sx={{
          mt: 4,
          mb: 4,
          bgcolor: 'black',
          color: 'white',
          p: 3,
          fontSize: '1.2rem',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        Start New Mushroom Growing
      </Button>
      <Dialog open={dialogOpen} onClose={closeDialog}>
        <DialogTitle>Confirm Stage Switch</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to switch to {newStage.charAt(0).toUpperCase() + newStage.slice(1)} Stage?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} color="primary">Cancel</Button>
          <Button onClick={confirmStageSwitch} color="secondary">Confirm</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={resetDialogOpen} onClose={closeResetDialog}>
        <DialogTitle>Confirm Reset</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to reset stages and start a new mushroom growing?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetDialog} color="primary">Cancel</Button>
          <Button onClick={confirmReset} color="secondary">Confirm</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={showWarning} onClose={() => setShowWarning(false)}>
        <DialogTitle>Warning</DialogTitle>
        <DialogContent>
          <DialogContentText>The sensor readings have not changed for a while. Please check the internet connection for the microcontrollers and ensure the actuators have power.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWarning(false)} color="primary">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SensorData;
