import axios from "axios";
import cheerio from "cheerio";
import { NextRequest, NextResponse } from "next/server";

export const config = {
  runtime: 'edge'
}

const URL = 'https://www.barbete.com/mobile-menu';

// The DOM structure of this page is very messy, hence all the manual string juggling/parsing

export default async function handler(req: NextRequest) {
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

    const result = Array.from(str.matchAll(regex), m => m[0]).map(e => e.trim());

    console.log(result)

    NextResponse.json(result);
  } catch (e) {
    throw e;
  }
}
