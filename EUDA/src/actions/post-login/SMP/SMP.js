exports.onExecutePostLogin = async (event, api) => {
  try {
    const apiKey = event.secrets.SMP_API_KEY;

    const response = await fetch('https://6a3ce682d8e212699e2302dd.mockapi.io/SMP', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    api.user.setUserMetadata('smp_data', data);

  } catch (error) {
    console.log('❌ SMP API call failed:', error.message);
  }
}