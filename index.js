const {Builder, By, Key, util, WebElement} = require("selenium-webdriver")
var secretJson = require("./secret.json"); //See secretStruct.json to create your own secret.json
var fs = require('fs');

var departments = []
var diciplines = []
var imgBaseSource = ["https://edisciplinas.usp.br/theme/image.php/edis/","/1620118355/icon"];
var assignText = imgBaseSource[0] + "assign" + imgBaseSource[1];
var quizText = imgBaseSource[0] + "quiz" + imgBaseSource[1];
var activityList = {"quizes":[],"assigns":[]};
var jsonData = {};

var dateDict = {"jan":0,"fev":1,"mar":2,"abr":3,"mai":4,"jun":5,"jul":6,"ago":7,"set":8,"out":9,"nov":10,"dez":11};
////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////           Used Methods           /////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

async function wait(timeInSeconds){
    await new Promise(resolve => setTimeout(resolve, 1000*timeInSeconds));
}

async function typeSlowly(driver,string,xpathStr,waitTimeKey,waitTimeEnd){
    for(const key of string){
        await driver.findElement(By.xpath(xpathStr)).sendKeys(key);
        await wait(waitTimeKey);
    }
    await wait(waitTimeEnd);
} 

async function clickLinkByPartialText(driver,partialText,waitTime){
    //await driver.findElement(By.xpath('//a[.//p[contains(text(),"Login")]]')).click();
    await driver.findElement(By.partialLinkText(partialText)).click();    
    await wait(waitTime);
}

async function clickXPath(driver,xPathStr,waitTime){
    await driver.findElement(By.xpath(xPathStr)).click();
    await wait(waitTime);
}

async function getElements(driver,xPathStr,waitTime){
    let elements = await driver.findElements(By.xpath(xPathStr));
    await wait(waitTime);
    return elements
}

async function clickXPathTC(driver,xPathStr,errorMessage,waitTime){
    let returnVal = true;
    try{
        await driver.findElement(By.xpath(xPathStr)).click();
    }
    catch(error){
        console.log(errorMessage);
        returnVal = false;
    }
    await wait(waitTime);
    return returnVal;
}


async function openWindow(driver,newWindowUrl,waitTime){
    await driver.executeScript('window.open("' + newWindowUrl + '");');
    
    let windows = await driver.getAllWindowHandles();
    await driver.switchTo().window(windows[windows.length - 1]);

    await wait(waitTime);
}

async function closeWindow(driver,waitTime){
    await driver.close();
    let windows = await driver.getAllWindowHandles();
    await driver.switchTo().window(windows[windows.length - 1]);
    await wait(waitTime);
}

async function getElemAttrByXPath(driver,xPathStr,attributeType,waitTime){
    var attribute = await driver.findElement(By.xpath(xPathStr)).getAttribute(attributeType);
    await wait(waitTime);
    return attribute;
}

async function getElemsAttrByXPath(driver,xPathStr,attributeType,waitTime){
    var elemAttrs = await driver.findElements(By.xpath(xPathStr))
    for(i = 0;i<elemAttrs.length;i++){
        elemAttrs[i] = await elemAttrs[i].getAttribute(attributeType);
    }
    await wait(waitTime);
    return elemAttrs;
}


async function getElemAttrByXPathTC(driver,xPathStr,attributeType,errorMessage,waitTime){
    var attribute;
    try{
        attribute = await driver.findElement(By.xpath(xPathStr)).getAttribute(attributeType);
    }
    catch{
        attribute = false;
        console.log(errorMessage)
    }
    await wait(waitTime);
    return attribute;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////              Pages               /////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////            Instagram             /////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////               Main               /////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
async function manageWindow(driver){
    await driver.manage().window().maximize();
}

async function logEdisciplinas(driver){
    await driver.get("https://edisciplinas.usp.br/acessar/");
    await wait(2);
    await clickXPath(driver,"//a[@href='https://edisciplinas.usp.br/auth/shibboleth']",2)
    await typeSlowly(driver,secretJson.login,"//input[@id='username']",0.05,0.5);
    await typeSlowly(driver,secretJson.senha,"//input[@id='password']",0.05,1.5);
    await clickXPath(driver,"//button[@type='submit']",15);
    console.log("Login done!");
}

async function getFullTimeName(time,timeName){
    var addTimeName = time === 1 ? timeName : timeName + "s";
    var addTimeVal = (time < 10) ? "0" + time : time;
    return addTimeVal + " " + addTimeName; 
}

async function getRemainingTime(endDate){
    var currentTime = new Date();
    var remainingTime = (endDate.getTime() - currentTime.getTime());

    var seconds = Math.floor((remainingTime / (1000)) % 60),
        minutes = Math.floor((remainingTime / (1000 * 60)) % 60),
        hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24),
        days = Math.floor((remainingTime / (1000 * 60 * 60 * 24)) % 7),
        weeks = Math.floor(remainingTime / (1000 * 60 * 60 * 24*7));
    

    weeks = await getFullTimeName(weeks,"semana");
    days = await getFullTimeName(days,"dia");
    hours = await getFullTimeName(hours,"hora");
    minutes = await getFullTimeName(minutes,"minuto");
    seconds = await getFullTimeName(seconds,"segundo");


    var remTimeStr = weeks + ", " + days + ", " + hours + ", " + minutes + " e " + seconds;

    return remTimeStr;
}

async function fixTimes(time){
    var timeList = String(time).split(", ").slice(1,3).join(" ").split(":").join(" ").split(" ");
    var timeDateType = new Date(Number(timeList[2]),dateDict[timeList[1]],Number(timeList[0]),Number(timeList[3]),Number(timeList[4]));
    return timeDateType;
}

async function activityIter(driver,it3,diciplineName,activityType,deadlineXPath,waitTime){
    await openWindow(driver,activityList[activityType][it3],waitTime);

    var activityTitle = await getElemAttrByXPath(driver,"//h2","innerHTML",waitTime/5);
    if(!(activityTitle in jsonData)){
        var deadlineStr = await getElemAttrByXPath(driver,deadlineXPath,"innerHTML",waitTime/5);
        
        var deadline = await fixTimes(deadlineStr);
        
        var curActivityJson = {"title" :String(activityTitle),"deadline":deadline.toISOString()};
        
        await jsonData[diciplineName][activityType].push(curActivityJson);
    }

    await closeWindow(driver,waitTime);
    return;
}


async function diciplinesIter(driver,it2,waitTime){
    var maxIt = 0;
    var iter = 0;

    await openWindow(driver,diciplines[it2],waitTime);

    var quizList = await getElemsAttrByXPath(driver,"//a[.//img[contains(@src,'quiz')]]","href",2);
    var assignList = await getElemsAttrByXPath(driver,"//a[.//img[contains(@src,'assign')]]","href",2);    
    if(quizList.length > 0 || assignList.length > 0){
        var diciplineName = await getElemAttrByXPath(driver,"//h1","innerHTML",waitTime/5); 
        jsonData[diciplineName] = {"assigns":[],"quizes":[]};
        activityList["quizes"] = quizList;
        activityList["assigns"] = assignList;
        maxIt = quizList.length + assignList.length;
        iter = 0;
        for(it3 = 0;it3<quizList.length;it3++){
            await activityIter(driver,it3,diciplineName,"quizes","//p[contains(.,'O questionário será fechado em')]",waitTime);
            iter += 1;
            console.log("\t\tActivities ",iter,"/",maxIt);
        }
        for(it3 = 0;it3<assignList.length;it3++){
            console.log("Going Inside activity");
            await activityIter(driver,it3,diciplineName,"assigns","//tr[.//th[contains(.,'Data de entrega')]]//td",waitTime);
            iter += 1;
            console.log("\t\tActivities ",iter,"/",maxIt);
        }
    }
    await closeWindow(driver,waitTime);
    return;
}

async function departmentIter(driver,it1,waitTime){
    let hrefAttr = await departments[it1].getAttribute("href");
    let diciplinesXPath ="//div[@id='" + String(hrefAttr).split("#")[1] + "']//h5[@class='item-cut']//a";

    await departments[it1].click();
    await wait(waitTime);
    diciplines = await getElemsAttrByXPath(driver,diciplinesXPath,"href",waitTime/5);

    for (var it2 = 0; it2 < diciplines.length; it2++){
        console.log("\tDiciplines ",(it2+1),"/",diciplines.length);
        await diciplinesIter(driver,it2,waitTime);
    }
    return;
}


async function fullIter(driver,waitTime){
    departments = await getElements(driver,"//a[contains(@class,'categorylink')]",waitTime/5);
    for (it1 = 0; it1 < departments.length; it1++){
        console.log("Department ",(it1+1),"/",departments.length);
        await departmentIter(driver,it1,waitTime)
    }
    return;
}

async function writeJson(){
}

async function readJson() { // TODO: make async function that reads 'activities.json' and puts it in jsonData
    return;
};

async function retrieveActivities(){
    await readJson();
    let driver = await new Builder().forBrowser("firefox").build();
    await manageWindow(driver);
    await logEdisciplinas(driver);
    await fullIter(driver,2.5);
    await writeJson();
    return;
}

retrieveActivities();