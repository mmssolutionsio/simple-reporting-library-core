import { defineEventHandler } from 'h3'
import { getRawData } from '../utils/srlData'

// Raw data only: the route table is rebuilt in the app (keeps the file small).
export default defineEventHandler(() => getRawData())
