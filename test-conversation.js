#!/usr/bin/env node
/**
 * Simple test script for the conversation API
 * Usage: node test-conversation.js
 */

require('dotenv').config();

const API_URL = 'http://localhost:3000/api';

// Demo credentials
const testUser = {
  email: 'dr.garcia@clinicanorte.com',
  password: 'doctor123'
};

let token = null;
let sessionId = null;

async function authenticate() {
  console.log('\n📝 [1/5] Authenticating...');
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const data = await res.json();
    if (!data.token) throw new Error('No token received');
    token = data.token;
    console.log('✅ Authenticated as:', testUser.email);
  } catch (err) {
    console.error('❌ Auth failed:', err.message);
    process.exit(1);
  }
}

async function createSession() {
  console.log('\n🎯 [2/5] Creating conversation session...');
  try {
    const res = await fetch(`${API_URL}/conversation/session`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.session?.session_id) throw new Error('No session created');
    sessionId = data.session.session_id;
    console.log('✅ Session created:', sessionId);
  } catch (err) {
    console.error('❌ Session creation failed:', err.message);
    process.exit(1);
  }
}

async function sendMessage(message) {
  console.log(`\n💬 [3/5] Sending message: "${message}"`);
  try {
    const res = await fetch(`${API_URL}/conversation/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    if (!data.result) throw new Error('No result received');

    console.log('\n✅ Claude response:');
    console.log(`   "${data.result.assistant_response}"`);

    if (data.result.tool_calls.length > 0) {
      console.log('\n🔧 Tools called:');
      data.result.tool_calls.forEach(tc => {
        console.log(`   - ${tc.name}`);
      });
    }

    return data.result;
  } catch (err) {
    console.error('❌ Message failed:', err.message);
    process.exit(1);
  }
}

async function getHistory() {
  console.log('\n📚 [4/5] Fetching conversation history...');
  try {
    const res = await fetch(`${API_URL}/conversation/${sessionId}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.messages) throw new Error('No messages received');

    console.log(`✅ Retrieved ${data.messages.length} messages`);
    data.messages.forEach(msg => {
      const role = msg.role === 'user' ? '👤' : '🤖';
      console.log(`   ${role} ${msg.role}: ${msg.content.substring(0, 60)}...`);
    });
  } catch (err) {
    console.error('❌ History fetch failed:', err.message);
    process.exit(1);
  }
}

async function closeSession() {
  console.log('\n🏁 [5/5] Closing session...');
  try {
    const res = await fetch(`${API_URL}/conversation/${sessionId}/close`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('✅ Session closed');
  } catch (err) {
    console.error('❌ Close failed:', err.message);
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Conversation API Test Suite');
  console.log('================================\n');

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ERROR: ANTHROPIC_API_KEY not set in .env');
    console.error('   Get your key from: https://console.anthropic.com/');
    process.exit(1);
  }

  await authenticate();
  await createSession();
  await sendMessage('¿Qué citas tengo hoy?');
  await sendMessage('¿Cuál es mi primera cita?');
  await getHistory();
  await closeSession();

  console.log('\n✨ All tests passed!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
