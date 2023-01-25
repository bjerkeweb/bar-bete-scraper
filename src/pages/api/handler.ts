import twilio from 'twilio';
import axios from "axios";
import cheerio from "cheerio";
import { NextApiRequest, NextApiResponse } from "next";

const TWILIO_ACCOUNT_SID = 'ACd998ee990bc7bd549b1ee1aa1eeffe24';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const twilio_client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const URL = 'https://www.barbete.com/mobile-menu';

// The DOM structure of this page is very messy, hence all the manual string juggling/parsing

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {

    const { data } = await axios.get(URL);

    const $ = cheerio.load(data);

    let content: string[] = [];

    $('.sqs-block-content > p').each((_idx, el) => {
      content.push($(el).text())
    });

    const end = content.findIndex(e => e.includes('Consuming raw or undercooked meats'));

    content = content.slice(0, end);

    const str = content.join();

    const regex = /(([A-Z]+?[\s,\-,&]+){1,})[a-z,à-ÿ,' ',\d,&,-]+/gm;

    // iterate over regex match groups, remove consecutive whitespaces
    const result = Array.from(str.matchAll(regex), m => m[0])
      .map(e => e.trim())
      .map(e => e.replace(/\s\s+/g, ' '));

    const message_body = result.join('\n').slice(0, 300);

    await twilio_client.messages.create({
      body: message_body,
      to: '+14152331791',
      from: '+18558193039'
    });

    res.status(200).json(message_body);
  } catch (e) {
    throw e;
  }
}
