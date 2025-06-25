
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fklndjdqlzeymfiuyxyr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrbG5kamRxbHpleW1maXV5eHlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDY3MTczNCwiZXhwIjoyMDY2MjQ3NzM0fQ.hnIMNmx4woi_DH3khVgnJxyX_Qqsux5iqSsI339F1N0'
export const supabase = createClient(supabaseUrl, supabaseKey)