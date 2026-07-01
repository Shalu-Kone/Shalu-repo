/**
 * Auth0 Post-Login Action: SMP API Integration
 * Makes an API call to retrieve SMP data and adds it to user metadata
 */

exports.onExecutePostLogin = async (event, api) => {
  const axios = require('axios');
  
  try {
    // Prepare API call
    const apiUrl = event.secrets.SMP_API_URL;
    const apiKey = event.secrets.SMP_API_KEY;
    
    const config = {
      method: 'GET',
      url: `https://6a3ce682d8e212699e2302dd.mockapi.io/SMP`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };
    
    // Make API call
    const response = await axios(config);
    
    // Add SMP data to user metadata
    api.user.setUserMetadata('smp_data', response.data);
    
  } catch (error) {
    console.error('SMP API call failed:', error.message);
    // Optionally, you can choose to continue or deny based on error handling
    // api.access.deny('SMP API integration failed');
  }
};

exports.onExecutePostLogin.bind = ['axios'];
