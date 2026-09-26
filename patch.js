  if (action === 'supermom_read_schedule') {
    let { date, startDate, endDate, clientName, limit } = args || {};
    let query = supabase.from('jobs').select('id, scheduled_date, scheduled_time, service_name, job_status, clients!inner(first_name, last_name)').eq('business_id', businessId).is('deleted_at', null);

    if (clientName) {
      clientName = clientName.replace(/[^\p{L} \-']/gu, '').trim();
      if (clientName.length >= 2) {
        const tokens = clientName.split(/\s+/);
        const orConditions = tokens.filter(t => t.length > 2 || tokens.length === 1).map(t => `first_name.ilike.%${t}%,last_name.ilike.%${t}%`).join(',');
        if (orConditions) {
          query = query.or(orConditions, { foreignTable: 'clients' });
        }
      }
    }

    if (date) {
      query = query.eq('scheduled_date', date);
    } else {
      if (startDate) query = query.gte('scheduled_date', startDate);
      if (endDate) query = query.lte('scheduled_date', endDate);
    }

    query = query.order('scheduled_date', { ascending: true }).order('scheduled_time', { ascending: true });
    
    if (limit) {
       query = query.limit(parseInt(limit, 10));
    } else if (!date && !startDate && !endDate) {
       const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
       if (!clientName) {
         query = query.gte('scheduled_date', today).limit(10);
       } else {
         query = query.limit(10);
       }
    }

    const { data: jobs, error: jobsErr } = await query;
    
    if (jobsErr) {
      console.error('[statlerTool] read_schedule query failed:', jobsErr.message);
      return res.status(500).json({ error: 'Failed to query schedule' });
    }

    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ result: 'No appointments found matching the criteria.' });
    }

    const formattedJobs = jobs.map(j => ({
      date: j.scheduled_date,
      time: j.scheduled_time,
      client: `${j.clients.first_name} ${j.clients.last_name}`,
      service: j.service_name,
      status: j.job_status
    }));

    return res.status(200).json({
      result: `Found ${jobs.length} appointments.`,
      jobs: formattedJobs
    });
  }
