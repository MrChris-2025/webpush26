// Netlify Functions use standard Node.js runtime environment
const subscriptionsDb = []; // Note: Use a real DB like Supabase/Fauna for persistence

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const subscription = JSON.parse(event.body);
    
    // Save the subscription object to your database here
    subscriptionsDb.push(subscription); 

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Subscription saved successfully!" }),
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};
