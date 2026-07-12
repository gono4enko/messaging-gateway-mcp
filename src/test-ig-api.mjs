// ponytail: verify igSendMessage works correctly

import { igSendMessage } from './ig-api.js';

// Mock fetch to simulate API responses
global.fetch = async (url, options) => {
  // Check if access_token is in the body
  const body = JSON.parse(options.body);
  if (!body.access_token) {
    return { 
      status: 401, 
      ok: false,
      json: async () => ({ error: 'Unauthorized' })
    };
  }
  
  // Simulate successful response
  if (body.recipient.user_id === 'valid_user' && body.message.text) {
    return { 
      status: 200, 
      ok: true,
      json: async () => ({ success: true })
    };
  }
  
  // Simulate error response
  return { 
    status: 400, 
    ok: false,
    json: async () => ({ error: 'Bad Request' })
  };
};

async function runTests() {
  console.log('Running igSendMessage tests...');
  
  // Test 1: Valid message with token parameter
  const result1 = await igSendMessage('valid_user', 'Hello World', 'test_token');
  console.log('Test 1 (valid message with token):', result1 ? 'PASS' : 'FAIL');
  
  // Test 2: Valid message with env token
  process.env.IG_ACCESS_TOKEN = 'env_token';
  const result2 = await igSendMessage('valid_user', 'Hello World');
  console.log('Test 2 (valid message with env token):', result2 ? 'PASS' : 'FAIL');
  
  // Test 3: Invalid user
  const result3 = await igSendMessage('invalid_user', 'Hello World', 'test_token');
  console.log('Test 3 (invalid user):', !result3 ? 'PASS' : 'FAIL');
  
  // Test 4: No access token
  delete process.env.IG_ACCESS_TOKEN;
  const result4 = await igSendMessage('valid_user', 'Hello World');
  console.log('Test 4 (no token):', !result4 ? 'PASS' : 'FAIL');
  
  console.log('Tests completed.');
}

runTests();