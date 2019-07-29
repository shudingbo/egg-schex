'use strict';

const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const con = require('./const.js');
const CornParser = require('cron-parser');

function timeout(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms, 'done');
  });
}


let YZSchedule = function( opt, agent ){
	let self = this;
	this.condef = con;
	this.jobStep = con.JobStep;
	this.agent = agent;
	this.logger = agent.getLogger('schexLogger');
	let drv = require( path.resolve(__dirname +"/drv/" + opt.cfg_drv));
	this.drv = drv( opt.cfg_opt, this );

	this.schedules = {};

	this.drv.start_monitor( function(schedulesCfg){
		self.checkSchedulesCfg( schedulesCfg );
	});

	this.logger.info( '[schex-ag] start init ...');
};


YZSchedule.prototype.runAction = function ( job, step, addInfo )
{
	let info = {
		name : job.name,
		fun : job.fun,
		parent: (job.parent!==null)?job.parent.name:null,
		cfg : this.getConfig( job.name ),
		step : step,
		ctx : job.ctx,
	};

	if( job.parent !== null ){
		info.ctx = job.parent.ctx;
	}

	if( addInfo !== undefined ){
		Object.assign( info, addInfo);
	}
	
	if( step === this.jobStep.STOP ){
		this.agent.messenger.sendToApp('egg-schex', info);
	}else{
		this.agent.messenger.sendRandom('egg-schex', info);
	}
};

YZSchedule.prototype.runActionToAll = function ( evtInfo )
{
	this.agent.messenger.sendToApp('egg-schex', evtInfo);
};


YZSchedule.prototype.onJobEvt = function( evtInfo ){
	this.logger.debug( `[schex-ag] ${evtInfo.name} ${evtInfo.step}`,evtInfo.ctx );

	if( evtInfo.method !== undefined )
	{
		this.evtMethod( evtInfo );
	}else{
		switch(evtInfo.step)
		{
			case this.jobStep.INIT:
				{
					this.evtInit( evtInfo );
				}break;
			case this.jobStep.RUN:
				{
					this.evtRun( evtInfo );
				}break;
			case this.jobStep.STOP:
				{
					this.evtStop( evtInfo );
				}break;
		}
	}
};

YZSchedule.prototype.evtMethod = function(evtInfo){
	let jobP = this.schedules[ evtInfo.name ];
	if( jobP !== undefined ){
			switch( evtInfo.method )
			{
				case con.Method.add:
					{
							let ret = addSubJob( this, evtInfo.addInfo.name, evtInfo.addInfo );
							if(ret === con.AddCode.OK || ret === con.AddCode.Exist){
								this.evtInit( evtInfo.addInfo );
								jobP.msg = `SubJob ${evtInfo.name} is starting...`;
								this.drv.update_Job( con.STA.RUN, jobP);
							}else{
								jobP.msg = `SubJob ${evtInfo.name} is starting err:${ret}`;
								this.drv.update_Job( con.STA.EXCEPTION, jobP);
							}
							this.logger.info( '[shex-ag]' + jobP.msg);
					}break;
				case con.Method.stop:
					{
						this.stopJob( jobP.name, jobP.msg );
					}
					break;
				case con.Method.start:
					{

					}break;
				case con.Method.up:
					{

					}break;
				case con.Method.rm:
					{

					}break;
				case con.Method.info:
					{
						if( jobP.parent !== null ){
							let p = jobP.parent;
							evtInfo.parent = {
								name:p.name,
								fun: p.fun,
								cfg : this.getConfig( p.name ),
							};
							evtInfo.ctx = p.ctx;
						}
						this.runActionToAll( evtInfo );
					}break;
			}
	}
};


YZSchedule.prototype.evtInit = function(evtInfo){

	let job = this.schedules[ evtInfo.name ];
	if( job.parent === null && job.hasInit === true ){ // Other worker job init OK.
		return;
	}
	if( evtInfo.err !== undefined && evtInfo.err !== null ){
		this.logger.warn(`[schex-ag] job ${evtInfo.name} init err:${evtInfo.msg}`);
		this.drv.update_Job( con.STA.EXCEPTION, job);
		return;
	}

	if( job.parent === null){
		job.ctx = evtInfo.ctx;
	}
	
	///
	let self = this;
	job.job = schedule.scheduleJob( job.cron, ()=>{
			self.runAction( job, con.JobStep.RUN,{} );
	});
		
	if( job.job !== null ){
		job.status = true;
		job.hasInit = true;
		job.startTime = Math.floor(Date.now()/1000);
		job.stopTime = 0;
		job.nextRunTime = getNextRunTime(job['cron']);
		job.msg = '';
	}else{
		job.status = false;
		job.startTime = 0;
		job.stopTime = 0;
		job.nextRunTime = 0;
		job.msg = 'corn parse error.';		
	}

	self.drv.update_Job( con.STA.START, job);

	if( job.parent !== null && job.parent !== undefined ){
		self.logger.info( `[shex-ag] run Sub Job [ ${job.name} ]`);	
	}else{
		self.logger.info( `[shex-ag] run Job [ ${job.name} ]`);
	}
};


YZSchedule.prototype.evtRun = function(evtInfo){
	let job = this.schedules[ evtInfo.name ];
	///////////
	if( evtInfo.err !== null ){
		this.logger.warn(`[shex-ag] job ${evtInfo.name} run err:${evtInfo.msg}`);
		this.drv.update_Job( con.STA.EXCEPTION, job);
		return;
	}

	//
	if( job.parent === null){
		job.ctx = evtInfo.ctx;
	}else{
		job.parent.ctx = evtInfo.ctx;
	}

	if( evtInfo.msg !== undefined ){
		job.msg = evtInfo.msg;
	}

	job.latestRunTime = Math.floor( Date.now()/1000);
	job.nextRunTime = getNextRunTime(job.cron);
	this.drv.update_Job( con.STA.RUN, job);
};

YZSchedule.prototype.evtStop = function(evtInfo){
	let job = this.schedules[ evtInfo.name ];
	
	if( evtInfo.err !== null ){
		this.logger.warn(`[shex-ag] job ${evtInfo.name} stop err:${evtInfo.msg}`);
		this.drv.update_Job( con.STA.EXCEPTION, job);
		return;
	}

	//
	if( job.parent === null){
		job.ctx = evtInfo.ctx;
	}else{
		job.parent.ctx = evtInfo.ctx;
	}

	if( evtInfo.msg !== undefined ){
		job.msg = evtInfo.msg;
	}

	if( job.restaring === true ){
		job.restaring = false;
		runJob( this, job );
	}
};

/**
 * run all job
 */
YZSchedule.prototype.run = function(){
	
	for( let job in this.schedules ){
		if( this.schedules[job].switch === true ){
			runJob( this,this.schedules[job] );
		}
	}
};

/**
 * Stop this module
 */
YZSchedule.prototype.stop = function(){
	onExit( this );
};

/**
 * Update Job，if cron or fun has change,and the job is running,then restart job.
 * - If job not run,only change the config.
 * - If job not exist,while add new job,but can't run it ,you must manual run it( call runJob );
 * 
 * @param  {string} name  job name
 * @param  {json object} scCfg {"corn":<* * * * * * *>,"fun":"","switch":true|false}
 * @return
 */
YZSchedule.prototype.updateJob = function(name,scCfg ){
	addJob( this, name, scCfg );
};


YZSchedule.prototype.removeSubJob = function( name ){
	return removeSubJob( this,name );
};


/**
 * run job
 * @param  {[type]} name job's name
 */
YZSchedule.prototype.runJob = function( name ){
	let job = this.schedules[ name ];
	if( job === undefined ){
		this.logger.info(`[shex-ag] job [ ${name}] not exist;`);
	}else{
		runJob( this, job );
	}
};

/**
 * run job
 * @param  {[type]} name job's name
 */
YZSchedule.prototype.stopJob = function( name, msg ){
	let job = this.schedules[ name ];
	if( job === undefined ){
		this.logger.info(`[shex-ag] job [ ${name}] not exist;`);
	}else{
		if( typeof(msg) === 'string' ){
			job.msg = msg;
		}

		stopJob( this, job );
	}
};

YZSchedule.prototype.checkSchedulesCfg = function( schedulesCfg ){
	let self = this;
	for( let sc in schedulesCfg ){
		let jobCfg = schedulesCfg[sc];
		let ret = addJob( self, sc, jobCfg );
		switch( ret ){
			case con.AddCode.OK:
			{
				if( jobCfg.switch === true ){
					runJob(self, self.schedules[sc] );
				}
			}
			break;
			case con.AddCode.Exception:
			{

			}
			break;
			case con.AddCode.Exist:
			{
				let thisJob = self.schedules[sc];
				if( jobCfg.switch === true ){
					if( thisJob.switch===false){
						if( thisJob.status === false ) {
							runJob(self,thisJob);
						}
					}else{
						thisJob.restaring = true;
					}
				}else{
						if( thisJob.status === true ){
							stopJob(self, thisJob);
						}
				}

				thisJob.switch = jobCfg.switch;
			}
			break;
		}
	}
};

YZSchedule.prototype.getConfig = function( jobname ){
	return this.drv.getConfig( jobname );	
};

YZSchedule.prototype.updateMsg = function( jobname, msg ){
	return this.drv.update_msg( jobname,msg );	
};


function onExit( self ){
	for( let job in self.schedules ){
		stopJob( self, self.schedules[job]);
	}

	self.drv.stop_monitor();
	self.logger.info('exit ...');
}

function getJobFunPath( jobFun ){
	let pwd = path.resolve(jobFun);
	if( fs.existsSync( pwd ) === true ){
		return pwd;
	}else{
		pwd = path.resolve('./node_modules/' +jobFun);
		if( fs.existsSync( pwd ) === true ){
			return jobFun;
		}
	}

	return '';
}

function runJob(self, job ){
	if( job.status === false){
		if( job.parent === null || job.parent === undefined )
		{
			self.runAction( job, self.jobStep.INIT ,{
				parent:null,
			});
		}
	}
}

function getNextRunTime( spec ){
	let val = 0;
	let nx = null;

	try {
		let inter = CornParser.parseExpression(spec);
		nx = inter.next();
		let curTime = Math.floor(Date.now()/1000);
		let nxTime = Math.floor(nx.valueOf()/1000);
		
		if( nxTime === curTime ){
			nx = inter.next();
		}
  } catch (err) {
		let type = typeof spec;
		if ((type === 'string') || (type === 'number')) {
			nx = new Date(spec);
		}
	}

	if( nx !== null ){
		val = Math.floor( nx.valueOf()/1000 );
	}

	return val;
}

function stopJob( self, job ){
	if( job.status === true){
		self.logger.info( `[shex-ag] [ ${job.name} ] stoping ...` );

		for( let j in self.schedules ){
			let jobT = self.schedules[j];
			if( jobT.parent !== null && jobT.parent.name === job.name ){
				if( jobT.status === true ){
					if( jobT.job !== null ){
						jobT.job.cancel();
						jobT.hasInit = false;
						jobT.status = false;
						jobT.stopTime =  Math.floor(Date.now()/1000);
						self.logger.info( `[shex-ag] [ ${jobT.name} ] stoped` );
						self.drv.update_Job( con.STA.STOP, jobT);
					}
					stopJob( self, jobT );					
				}
			}
		}

		self.runAction( job, con.JobStep.STOP);

		if( job.job !== null ){
			job.job.cancel();
			job.hasInit = false;
			job.status = false;
			job.stopTime =  Math.floor(Date.now()/1000);
			self.logger.info( `[shex-ag] [ ${job.name} ] stoped` );
			self.drv.update_Job( con.STA.STOP, job);
		}
	}
}


function addJob( self, name,scCfg ){
	if( self.schedules[ name ] === undefined || self.schedules[ name ] === null )
	{
		let jobTmp = {name:name,
				ctx : {},          // job 执行上下文，存储job逻辑需要的数据
				cron:scCfg.cron,
				fun :scCfg.fun,
				switch:scCfg.switch,
				status:false,
				ins : null,   // 函数实例
				job:null,     // jobID
				startTime:0,
				stopTime:0,
				latestRunTime:0,
				msg:'',
				parent:null
			};

		let pwd = getJobFunPath(scCfg.fun);
		if( pwd.length > 2 ){
			self.schedules[name] = jobTmp;
			self.logger.info( `[shex-ag] add Job [ ${name} ]` );
			return con.AddCode.OK;
		}else{
			let msg = scCfg.fun + " not exists!";
			jobTmp.msg = msg;
			self.drv.update_Job( con.STA.EXCEPTION, jobTmp);
			self.logger.info( `[shex-ag] add Job [ ${name} ] fun not exist` );
			return con.AddCode.Exception;
		}
	}else{
		let hasChange = false;
		let thisJob = self.schedules[name];
		if( thisJob.cron !== scCfg.cron){
			thisJob.cron = scCfg.cron;
			hasChange = true;
		}

		if( thisJob.fun !== scCfg.fun){
			thisJob.fun = scCfg.fun;
			hasChange = true;
		}

		if( hasChange === true ){
			self.logger.info( `[shex-ag] Change Job [ ${name} ]` );
			stopJob( self, thisJob );
		}
	}

	self.logger.info( `[shex-ag] add Job [ ${name} ] has exist` );
	return con.AddCode.Exist;
}

/** Add Sub Job,The child and parent to use the same function
 * 
 * 
 */
function addSubJob( self, name,scCfg ){

	if( scCfg.parent === undefined ){
		self.logger.warn( '[shex-ag] no parent info' );
		return con.AddCode.Exception;
	}

  let jobParent = self.schedules[ scCfg.parent ];
	if( jobParent === undefined ){
		self.logger.warn( '[shex-ag] not find parent info' );
		return con.AddCode.Exception;
	}

	if( self.schedules[ name ] === undefined )
	{
		let jobTmp = {name:name,
				cron:scCfg.cron,
				fun :scCfg.fun,
				switch:scCfg.switch,
				status:false,
				ins : jobParent.ins,   // 函数实例
				job:null,     // jobID
				startTime:0,
				stopTime:0,
				latestRunTime:0,
				msg:'',
				parent:jobParent
			};

		self.schedules[name] = jobTmp;
		self.logger.info( `[shex-ag] add Sub Job [ ${name} ]` );
		return con.AddCode.OK;
	}else{
		let hasChange = false;
		let thisJob = self.schedules[name];
		if( thisJob.cron !== scCfg.cron){
			thisJob.cron = scCfg.cron;
			hasChange = true;
		}

		// 记录任务当前状态 
		if( hasChange === true ){
			self.logger.info( `[shex-ag] Change Sub Job [ ${name} ]` );
			stopJob( self, thisJob );
			if( thisJob.status === true ){
				runJob(self, thisJob );
			}
		}
	}

	self.logger.info( `[shex-ag] add Sub Job [ ${name} ] has exist` );
	return con.AddCode.Exist;
}

function removeSubJob( self ,name )
{
	if( self.schedules[ name ] !== undefined ){

		stopJob( self, self.schedules[ name ] );
		let parJob = self.schedules[ name ].parent;
		
		if( parJob !== undefined && parJob !== null ){
			let schs = self.schedules;
			delete schs[name];
			self.drv.removeJob( name );
		}
	}
}


//////////////
module.exports = function( opt, agent ){
	return new YZSchedule( opt, agent );
};
