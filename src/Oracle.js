// src/Oracle.js - Fix for Jest dynamic import issue
// Jest has trouble with dynamic imports inside classes during tests without special config.
// For simplicity, let's revert to standard require since node-fetch v3 is ESM-only.
// We can use 'cross-fetch' or similar if needed, or just standard http/https for zero-dep.
// Actually, let's use standard 'https' to avoid dependency issues entirely in the core.

const https = require('https');
const EventEmitter = require('events');
require('dotenv').config();

class Oracle extends EventEmitter {
  constructor() {
    super();
    if (Oracle.instance) {
      return Oracle.instance;
    }
    
    // Default Price: 1g Silver = $0.80 USD (approx)
    this.silverPriceUSD = 0.80;
    this.lastUpdated = Date.now();
    this.apiKey = process.env.METAL_PRICE_API_KEY;
    this.apiUrl = 'https://api.metalpriceapi.com/v1/latest';
    
    // Start auto-update if key exists
    if (this.apiKey) {
        console.log("Starting Live Silver Price Feed...");
        this.fetchLivePrice();
        // Update every 60 seconds
        setInterval(() => this.fetchLivePrice(), 60000);
    } else {
        // console.log("No API Key provided. Using static Silver Price.");
    }
    
    Oracle.instance = this;
  }

  fetchLivePrice() {
      if (!this.apiKey) return;

      const url = `${this.apiUrl}?api_key=${this.apiKey}&base=USD&currencies=XAG`;
      
      https.get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
              try {
                  const json = JSON.parse(data);
                  if (json.success && json.rates && json.rates.XAG) {
                      const ouncesPerUSD = json.rates.XAG;
                      const usdPerOunce = 1 / ouncesPerUSD;
                      const usdPerGram = usdPerOunce / 31.1034768;
                      
                      const newPrice = parseFloat(usdPerGram.toFixed(4));
                      
                      if (this.silverPriceUSD !== newPrice) {
                          this.silverPriceUSD = newPrice;
                          this.lastUpdated = Date.now();
                          console.log(`Updated Silver Price: $${this.silverPriceUSD}/g`);
                          this.emit('price_update', this.silverPriceUSD);
                      }
                  }
              } catch (e) {
                  console.error("Failed to parse Oracle response:", e.message);
              }
          });
      }).on('error', (e) => {
          console.error("Failed to fetch silver price:", e.message);
      });
  }

  getPrice() {
    return this.silverPriceUSD;
  }

  setPrice(newPrice) {
    this.silverPriceUSD = newPrice;
    this.lastUpdated = Date.now();
    this.emit('price_update', this.silverPriceUSD);
  }
}

module.exports = new Oracle();
