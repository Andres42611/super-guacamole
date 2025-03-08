import json
import time
import threading
import requests
import subprocess
import re
import os
import boto3
from flask import Flask, render_template, send_from_directory, request

app = Flask(__name__, template_folder="templates", static_folder="static")

# Store playback URL and AWS IVS details dynamically
playback_url = None
ivs_client = boto3.client("ivs", region_name="us-west-2")  # Change region as needed

def get_existing_channel():
    """Checks if an IVS channel with a given name exists and retrieves its details."""
    try:
        response = ivs_client.list_channels()
        for channel in response.get("channels", []):
            if channel["name"] == "LiveStreamChannel":
                stream_keys_response = ivs_client.list_stream_keys(channelArn=channel["arn"])
                if stream_keys_response["streamKeys"]:
                    stream_key_arn = stream_keys_response["streamKeys"][0]["arn"]
                    stream_key_details = ivs_client.get_stream_key(arn=stream_key_arn)
                    stream_key_value = stream_key_details["streamKey"]["value"]
                    
                    print("\n✅ Found existing AWS IVS Channel!")
                    return channel["playbackUrl"], channel["ingestEndpoint"], stream_key_value
    except Exception as e:
        print(f"⚠️ ERROR: Failed to check for existing AWS IVS channel - {e}")
    return None, None, None

def create_ivs_channel():
    """Creates an AWS IVS channel within the free tier (basic channel)."""
    try:
        response = ivs_client.create_channel(
            name="LiveStreamChannel",
            latencyMode="LOW",  # Low latency is supported in basic channels
            type="BASIC",  # Ensures this is a basic channel (free tier eligible)
            authorized=False  # Publicly accessible
        )
        
        channel = response["channel"]
        stream_key = response["streamKey"]

        playback_url = channel["playbackUrl"]
        ingest_endpoint = channel["ingestEndpoint"]
        stream_key_value = stream_key["value"]

        print("\n✅ AWS IVS Basic Channel Created (Free Tier Eligible)!")
        print(f"🎥 Playback URL: {playback_url}")
        print(f"📡 Ingest Endpoint: {ingest_endpoint}")
        print(f"🔑 Stream Key: {stream_key_value}")

        return playback_url, ingest_endpoint, stream_key_value
    
    except Exception as e:
        print(f"⚠️ ERROR: Failed to create AWS IVS channel - {e}")
        return None, None, None

def start_cloudflare_tunnel():
    """Starts Cloudflare Tunnel and extracts the public URL."""
    try:
        print("\n🔄 Starting Cloudflare Tunnel...")

        process = subprocess.Popen(
            ["cloudflared", "tunnel", "--url", "http://localhost:5000"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )

        public_url = None
        url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

        for line in iter(process.stdout.readline, ''):
            print(line.strip())  # Print Cloudflare output in real-time
            match = url_pattern.search(line)
            if match:
                public_url = match.group(0)
                print(f"🌍 Public Broadcast URL: {public_url}")
                break  

        return public_url

    except Exception as e:
        print(f"⚠️ ERROR: Failed to start Cloudflare Tunnel - {e}")
        return None

@app.route('/')
def index():
    """Serves the front-end HTML and allows the user to enter their stream key & ingest URL."""
    return render_template('index.html', playback_url=playback_url)

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serves static files such as JavaScript."""
    return send_from_directory('static', filename)

@app.route('/update_playback', methods=['POST'])
def update_playback():
    """Receives the playback URL from the front-end and updates it dynamically."""
    global playback_url
    data = request.json
    playback_url = data.get("playback_url")
    return json.dumps({"success": True, "playback_url": playback_url})

@app.route('/switch')
def switch_broadcaster():
    """Simulates broadcaster handoff."""
    print("\n🔄 Switching Broadcaster...")
    return "Switched!"

def run_flask():
    """Runs Flask in a separate thread to avoid blocking the main program."""
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    # Ensure the 'static' directory exists
    if not os.path.exists('static'):
        os.makedirs('static')

    # Copy ivs_broadcastswitch.js to static if not already there
    if not os.path.exists('static/ivs_broadcastswitch.js'):
        os.system('cp ivs_broadcastswitch.js static/')

    threading.Thread(target=run_flask, daemon=True).start()
    time.sleep(2)  # Give Flask time to start

    cloudflare_url = start_cloudflare_tunnel()
    if cloudflare_url:
        print(f"\n🌐 Open {cloudflare_url} to start broadcasting.")

    # Check for an existing AWS IVS channel before creating a new one
    ivs_playback_url, ivs_ingest_endpoint, ivs_stream_key = get_existing_channel()
    if not ivs_playback_url:
        ivs_playback_url, ivs_ingest_endpoint, ivs_stream_key = create_ivs_channel()
    
    while True:
        action = input("\n🔄 Press 'Enter' to switch to a new broadcaster or type 'exit' to stop: ").strip()
        
        if action.lower() == "exit":
            print("\n⏹ Stopping stream...")
            break

        print("\n🔄 Switching broadcaster...")
        requests.get(f"{cloudflare_url}/switch")  # Notify the front-end
